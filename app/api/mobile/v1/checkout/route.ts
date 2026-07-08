import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import {
  enforceMobileRateLimit,
  enforceCheckoutRateLimit,
} from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { createMobileServiceClient } from "@/lib/mobile/supabase";
import { computeBasketHash, type CheckoutItem } from "@/lib/mobile/commerce";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  event_id: z.number().int().positive().optional(),
  tickets: z
    .array(
      z.object({
        ticket_type_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  customer: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    phone: z.string().min(1).max(40),
    cnic: z.string().regex(/^\d{13}$/),
  }),
});

type CreateBookingArgs =
  Database["public"]["Functions"]["create_booking_with_reservation"]["Args"];

/**
 * POST /api/mobile/v1/checkout
 *
 * Creates (or idempotently reuses) a booking for the caller and arms the PayFast
 * payment. Booking creation goes through the SECURITY DEFINER
 * `create_booking_with_reservation` RPC WITH `p_basket_id` - its
 * `ON CONFLICT (user_id, basket_id)` makes creation atomically idempotent (this
 * is the double-charge fix the website route lacks: it omits `p_basket_id` and
 * sets it in a separate UPDATE). Amount is server-authoritative; CNIC is hashed
 * in the DB and only `cnic_last4` is ever exposed. Mirrors `app/api/tickets/checkout`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);
  await enforceCheckoutRateLimit(user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    const path = issue?.path.join(".") ?? "";
    const code = path.startsWith("customer.cnic")
      ? "cnic_invalid"
      : path === "tickets"
        ? "empty_cart"
        : "validation_error";
    throw new MobileApiError(
      code,
      issue?.message ?? "Invalid checkout request.",
      400,
      path || undefined,
    );
  }
  const { tickets, customer } = parsed.data;

  // Aggregate duplicate ticket types.
  const agg = new Map<number, number>();
  for (const t of tickets) {
    agg.set(t.ticket_type_id, (agg.get(t.ticket_type_id) ?? 0) + t.quantity);
  }
  const items: CheckoutItem[] = [...agg.entries()].map(
    ([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }),
  );

  // Friendly pre-validation (the RPC re-checks authoritatively under a row lock).
  const ids = items.map((i) => i.ticket_type_id);
  const { data: types, error: ttErr } = await supabase
    .from("ticket_types")
    .select("id, event_id, quantity_available, sale_starts_at, sale_ends_at")
    .in("id", ids);
  if (ttErr) {
    console.error(
      "[mobile-api] checkout ticket_types lookup failed:",
      ttErr.message,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to validate tickets.",
      500,
    );
  }
  const rows = types ?? [];
  if (ids.some((id) => !rows.some((r) => r.id === id))) {
    throw new MobileApiError(
      "ticket_type_missing",
      "One or more ticket types were not found.",
      400,
      "tickets",
    );
  }
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  if (eventIds.length !== 1) {
    throw new MobileApiError(
      "event_id_mismatch",
      "All tickets must be for the same event.",
      400,
      "tickets",
    );
  }
  const eventId = eventIds[0];
  if (parsed.data.event_id && parsed.data.event_id !== eventId) {
    throw new MobileApiError(
      "event_id_mismatch",
      "The provided event_id does not match the tickets.",
      400,
      "event_id",
    );
  }
  const now = new Date();
  for (const it of items) {
    const row = rows.find((r) => r.id === it.ticket_type_id)!;
    if (
      now < new Date(row.sale_starts_at) ||
      now > new Date(row.sale_ends_at)
    ) {
      throw new MobileApiError(
        "sale_window_closed",
        "Ticket sales are closed for one of the selected tickets.",
        400,
        "tickets",
      );
    }
    if (
      row.quantity_available !== null &&
      row.quantity_available < it.quantity
    ) {
      throw new MobileApiError(
        "ticket_type_insufficient",
        "Not enough tickets remaining.",
        400,
        "tickets",
      );
    }
  }

  const basket = computeBasketHash(user.id, eventId, items, customer.cnic);

  // Reuse an existing unpaid booking for this basket (drives the UX `reused`
  // flag); the RPC's ON CONFLICT is the real atomic dedup.
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .eq("basket_id", basket)
    .in("payment_status", ["awaiting_payment", "pending"])
    .order("id", { ascending: false })
    .maybeSingle();

  const service = createMobileServiceClient();
  let bookingId: number;
  let reused = false;
  if (existing) {
    bookingId = existing.id;
    reused = true;
  } else {
    const args: CreateBookingArgs = {
      p_user_id: user.id,
      p_items: items as CreateBookingArgs["p_items"],
      p_customer_name: customer.name,
      p_customer_email: customer.email,
      p_customer_phone: customer.phone,
      p_customer_cnic: customer.cnic,
      p_basket_id: basket,
    };
    const { data: newId, error: rpcErr } = await service.rpc(
      "create_booking_with_reservation",
      args,
    );
    if (rpcErr || newId == null) {
      const msg = rpcErr?.message ?? "";
      if (/sale window/i.test(msg))
        throw new MobileApiError(
          "sale_window_closed",
          "Ticket sales are closed.",
          400,
        );
      if (/insufficient quantity/i.test(msg))
        throw new MobileApiError(
          "ticket_type_insufficient",
          "Not enough tickets remaining.",
          400,
        );
      if (/not found/i.test(msg))
        throw new MobileApiError(
          "ticket_type_missing",
          "One or more ticket types were not found.",
          400,
        );
      if (/per-person limit/i.test(msg))
        throw new MobileApiError(
          "per_person_limit",
          "Per-person ticket limit exceeded.",
          400,
        );
      console.error("[mobile-api] checkout RPC failed:", msg);
      throw new MobileApiError(
        "internal_error",
        "Failed to create booking.",
        500,
      );
    }
    bookingId = newId;
  }

  const { data: booking, error: bErr } = await service
    .from("bookings")
    .select("id, booking_reference, total_amount, payment_status")
    .eq("id", bookingId)
    .single();
  if (bErr || !booking) {
    console.error("[mobile-api] checkout booking fetch failed:", bErr?.message);
    throw new MobileApiError("internal_error", "Failed to load booking.", 500);
  }

  // Ensure a payment row exists (mirrors the website).
  const { data: payExisting } = await service
    .from("payments")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("gateway_code", "payfast")
    .maybeSingle();
  if (!payExisting) {
    const { error: payErr } = await service.from("payments").insert({
      booking_id: bookingId,
      gateway_code: "payfast",
      amount: booking.total_amount,
      currency: "PKR",
      status: "AWAITING_DETAILS",
      normalized_status: "awaiting_payment",
    });
    if (payErr) {
      console.error(
        "[mobile-api] checkout payment init failed:",
        payErr.message,
      );
      throw new MobileApiError(
        "internal_error",
        "Failed to initialize payment.",
        500,
      );
    }
  }

  const paymentStatus = booking.payment_status ?? "awaiting_payment";
  const paymentStage =
    paymentStatus === "paid"
      ? "completed"
      : paymentStatus === "awaiting_payment" && reused
        ? "awaiting_otp"
        : "awaiting_payment_details";

  return ok(
    {
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      amount: booking.total_amount,
      currency: "PKR",
      gateway: "payfast",
      payment_status: paymentStatus,
      payment_stage: paymentStage,
      mock_mode: false,
      reused,
      poll_interval_ms: 4000,
    },
    undefined,
    { status: 201 },
  );
});
