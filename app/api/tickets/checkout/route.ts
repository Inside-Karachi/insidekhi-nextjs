import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  CheckoutRequestBody,
  CheckoutSessionResponse,
  PaymentStage,
  BookingPaymentStatus,
} from "@/types/payments.types";
import { Database } from "@/types/supabase";
import crypto from "crypto";
import {
  checkCheckoutRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limiter-distributed";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

// Payment gateway code constant
const PAYMENT_GATEWAY_CODE = "payfast";
const CHECKOUT_ROUTE = "/api/tickets/checkout";

interface ApiErrorShape {
  error: string;
  error_code: string;
  details?: Record<string, unknown>;
}
const DEBUG_MODE = process.env.NEXT_DEBUG === "true";
function bad(
  msg: string,
  status = 400,
  code = "BAD_REQUEST",
  details?: Record<string, unknown>,
  captureError?: unknown,
) {
  if (status >= 500) {
    const err =
      captureError instanceof Error
        ? captureError
        : new Error(
            typeof details?.message === "string" ? details.message : msg,
          );
    captureRouteError(err, {
      route: CHECKOUT_ROUTE,
      method: "POST",
      extra: { code, ...details },
    });
  }
  const payload: ApiErrorShape = { error: msg, error_code: code, details };
  return NextResponse.json(payload, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckoutRequestBody = await req.json();
    if (!body?.tickets?.length)
      return bad("No tickets provided", 400, "NO_TICKETS");
    if (!body.customer?.cnic) return bad("CNIC required", 400, "CNIC_REQUIRED");
    if (!/^\d{13}$/.test(body.customer.cnic))
      return bad("Invalid CNIC format", 400, "CNIC_INVALID");

    const supabase = await createServerSupabase();
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return bad("Authentication required", 401, "AUTH_REQUIRED");

    // PHASE 1 FIX: Distributed rate limiting
    const rateLimitResult = await checkCheckoutRateLimit(req, user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(createRateLimitResponse(rateLimitResult), {
        status: 429,
      });
    }

    const rawItems = body.tickets;
    if (!Array.isArray(rawItems)) {
      return bad("Invalid items payload", 400, "INVALID_ITEMS_SHAPE");
    }
    const normalized: { ticket_type_id: number; quantity: number }[] = [];
    for (const [idx, it] of rawItems.entries()) {
      if (!it || typeof it !== "object") {
        return bad("Invalid ticket item", 400, "INVALID_ITEM_TYPE", {
          index: idx,
        });
      }
      const rec = it as unknown as Record<string, unknown>;
      const ticket_type_id = rec["ticket_type_id"];
      const quantity = rec["quantity"];
      if (ticket_type_id === undefined || quantity === undefined) {
        return bad("Missing item keys", 400, "INVALID_ITEM_KEYS", {
          index: idx,
          keys: Object.keys(it || {}),
        });
      }
      const idNum = Number(ticket_type_id);
      const qtyNum = Number(quantity);
      if (!Number.isInteger(idNum) || idNum <= 0) {
        return bad("Invalid ticket_type_id", 400, "INVALID_TICKET_TYPE_ID", {
          index: idx,
          value: ticket_type_id,
        });
      }
      if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
        return bad("Invalid quantity", 400, "INVALID_QUANTITY", {
          index: idx,
          value: quantity,
        });
      }
      normalized.push({ ticket_type_id: idNum, quantity: qtyNum });
    }
    const aggregated: Record<number, number> = {};
    for (const n of normalized) {
      aggregated[n.ticket_type_id] =
        (aggregated[n.ticket_type_id] || 0) + n.quantity;
    }
    const items = Object.entries(aggregated).map(([id, q]) => ({
      ticket_type_id: Number(id),
      quantity: q,
    }));
    // Pre-validation of ticket types (helps distinguish RLS vs real absence before RPC)
    const ticketTypeIds = items.map((i) => i.ticket_type_id);
    const { data: ticketTypes, error: ttErr } = await supabase
      .from("ticket_types")
      .select(
        "id,event_id,quantity_available,sale_starts_at,sale_ends_at,max_per_person,price",
      )
      .in("id", ticketTypeIds);
    if (ttErr) {
      console.error("[checkout] ticket_types query error", {
        code: ttErr.code,
        message: ttErr.message,
      });
      return bad(
        "Ticket type lookup failed",
        500,
        "TICKET_TYPE_QUERY_FAILED",
        { message: ttErr.message, code: ttErr.code },
        ttErr,
      );
    }
    const foundIds = new Set((ticketTypes || []).map((r) => r.id));
    const missing = ticketTypeIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      console.warn("[checkout] missing ticket_types before RPC", {
        requested: ticketTypeIds,
        missing,
      });
      return bad(
        "One or more ticket types not found",
        400,
        "TICKET_TYPE_MISSING",
        { requested: ticketTypeIds, missing },
      );
    }
    // Ensure single event
    const eventIds = Array.from(
      new Set((ticketTypes || []).map((r) => r.event_id)),
    );
    if (eventIds.length !== 1) {
      console.warn("[checkout] mixed event ids detected", { eventIds });
      return bad(
        "Mixed event ticket types not allowed",
        400,
        "TICKET_EVENT_MISMATCH",
        { event_ids: eventIds },
      );
    }
    // Optionally validate requested event_id matches (soft check; DB enforces in function anyway)
    if (body.event_id && body.event_id !== eventIds[0]) {
      console.warn("[checkout] event_id mismatch", {
        provided: body.event_id,
        derived: eventIds[0],
      });
      return bad(
        "Provided event_id does not match ticket types",
        400,
        "EVENT_ID_MISMATCH",
        { provided: body.event_id, derived: eventIds[0] },
      );
    }
    // Validate sale windows & quantity (non-authoritative; race handled in RPC)
    const nowIso = new Date();
    for (const it of items) {
      const row = ticketTypes!.find((r) => r.id === it.ticket_type_id)!;
      const starts = new Date(row.sale_starts_at as string);
      const ends = new Date(row.sale_ends_at as string);
      if (nowIso < starts || nowIso > ends) {
        console.warn("[checkout] sale window closed", {
          ticket_type_id: row.id,
        });
        return bad(
          "Sale window closed for a ticket type",
          400,
          "SALE_WINDOW_CLOSED",
          { ticket_type_id: row.id },
        );
      }
      if (
        row.quantity_available !== null &&
        row.quantity_available < it.quantity
      ) {
        console.warn("[checkout] insufficient quantity", {
          ticket_type_id: row.id,
          requested: it.quantity,
          available: row.quantity_available,
        });
        return bad("Insufficient quantity", 400, "TICKET_TYPE_INSUFFICIENT", {
          ticket_type_id: row.id,
          requested: it.quantity,
          available: row.quantity_available,
        });
      }
    }

    // Build deterministic basket hash for idempotency (sorted ticket_type_id + qty)
    const basketPayload = {
      event_id: eventIds[0],
      items: items
        .slice()
        .sort((a, b) => a.ticket_type_id - b.ticket_type_id)
        .map((i) => `${i.ticket_type_id}x${i.quantity}`),
      cnic_hash_preview: body.customer.cnic.slice(-4), // low entropy; just assists visibility
    };
    const basketHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(basketPayload))
      .digest("hex")
      .slice(0, 32);

    // Attempt reuse of existing awaiting_payment booking with identical basket
    let reused = false;
    let bookingId: number | null = null;
    const { data: existingBooking, error: existingErr } = await supabase
      .from("bookings")
      .select("id, payment_status, basket_id")
      .eq("user_id", user.id)
      .eq("event_id", eventIds[0])
      .eq("basket_id", basketHash)
      .in("payment_status", ["awaiting_payment", "pending"])
      .order("id", { ascending: false })
      .maybeSingle();
    if (existingErr) {
      console.warn("[checkout] basket reuse lookup error", {
        code: existingErr.code,
        message: existingErr.message,
      });
    } else if (existingBooking) {
      reused = true;
      bookingId = existingBooking.id;
    }

    let rpcErr;
    if (!bookingId) {
      // Create booking via RPC
      const rpcRes = await serviceSupabase.rpc(
        "create_booking_with_reservation",
        {
          p_user_id: user.id,
          p_items:
            items as unknown as Database["public"]["Functions"]["create_booking_with_reservation"]["Args"]["p_items"],
          p_customer_name: body.customer.name,
          p_customer_email: body.customer.email,
          p_customer_phone: body.customer.phone,
          p_customer_cnic: body.customer.cnic,
        },
      );
      rpcErr = rpcRes.error;
      bookingId = rpcRes.data || null;
      if (!rpcErr && bookingId) {
        // Attach basket hash for future idempotent reuse
        const { error: basketUpdateErr } = await supabase
          .from("bookings")
          .update({ basket_id: basketHash })
          .eq("id", bookingId);
        if (basketUpdateErr && DEBUG_MODE) {
          console.warn("[checkout][debug] failed to set basket_id", {
            booking_id: bookingId,
            basketUpdateErr,
          });
        }
      }
    }
    if (rpcErr || !bookingId) {
      if (DEBUG_MODE)
        console.error("[checkout][debug] RPC failure diag", {
          p_items: items,
          rpc_message: rpcErr?.message,
          rpc_code: rpcErr?.code,
          rpc_hint: rpcErr?.hint,
        });
      console.error("[checkout] booking RPC failure", { rpcErr });
      // Additional targeted diagnostics when ticket type missing
      let extra: Record<string, unknown> | undefined;
      if (rpcErr?.message) {
        const m = rpcErr.message.match(/Ticket type (\d+) not found/);
        if (m) {
          const missingId = Number(m[1]);
          const { data: diagRow, error: diagErr } = await supabase
            .from("ticket_types")
            .select(
              "id,event_id,name,quantity_available,sale_starts_at,sale_ends_at",
            )
            .eq("id", missingId)
            .maybeSingle();
          extra = {
            missing_ticket_type_id: missingId,
            api_visible: !!diagRow,
            api_row: diagRow || null,
            api_row_error: diagErr
              ? { message: diagErr.message, code: diagErr.code }
              : null,
            passed_items: items,
          };
        }
      }
      if (
        extra &&
        typeof (extra as Record<string, unknown>).api_visible === "boolean" &&
        (extra as Record<string, unknown>).api_visible
      ) {
        return bad(
          "Internal booking inconsistency",
          500,
          "RPC_TICKET_VISIBLE_BUT_NOT_FOUND_IN_FUNCTION",
          {
            original_message: rpcErr?.message,
            diagnostics: extra,
            note: "ticket_types row was selectable in API layer but missing in transactional function; review function definition or RLS state",
          },
          rpcErr ?? new Error("RPC ticket visible but not found in function"),
        );
      }
      return bad(
        "Booking creation failed",
        500,
        "BOOKING_CREATE_FAILED",
        rpcErr
          ? {
              message: rpcErr.message,
              code: rpcErr.code,
              hint: rpcErr.hint,
              diagnostics: extra,
            }
          : extra,
        rpcErr ?? new Error("Booking RPC failed"),
      );
    }

    const { data: bookingRow, error: bErr } = await supabase
      .from("bookings")
      .select("id, booking_reference, total_amount, payment_status")
      .eq("id", bookingId)
      .single();
    if (bErr || !bookingRow) {
      console.error("[checkout] booking fetch failed", { bErr });
      return bad(
        "Booking fetch failed",
        500,
        "BOOKING_FETCH_FAILED",
        { message: bErr?.message },
        bErr ?? new Error("Booking row missing after RPC"),
      );
    }
    const amount = bookingRow.total_amount || 0;
    const currency = "PKR";

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("gateway_code", PAYMENT_GATEWAY_CODE)
      .maybeSingle();
    if (!existing) {
      const { error: payErr } = await supabase.from("payments").insert({
        booking_id: bookingId,
        gateway_code: PAYMENT_GATEWAY_CODE,
        amount,
        currency,
        status: "AWAITING_DETAILS",
        normalized_status: "awaiting_payment",
      });
      if (payErr) {
        console.error("[checkout] payment record init failed", { payErr });
        return bad(
          "Payment record init failed",
          500,
          "PAYMENT_RECORD_INIT_FAILED",
          { message: payErr.message },
          payErr,
        );
      }
    }

    // Build gateway initiation payload
    const bookingReference = bookingRow.booking_reference || `${bookingId}`;
    const mockMode = false; // Not using test mode for PayFast

    const normalizedStatus =
      (bookingRow.payment_status as BookingPaymentStatus | null) ??
      "awaiting_payment";

    let paymentStage: PaymentStage = "awaiting_payment_details";
    if (normalizedStatus === "paid") {
      paymentStage = "completed";
    } else if (normalizedStatus === "awaiting_payment" && reused) {
      paymentStage = "awaiting_otp";
    }

    if (normalizedStatus !== "awaiting_payment") {
      try {
        await supabase
          .from("bookings")
          .update({ payment_status: "awaiting_payment" })
          .eq("id", bookingId);
      } catch (updateErr) {
        if (DEBUG_MODE) {
          console.warn(
            "[checkout][debug] failed to set booking payment_status",
            {
              booking_id: bookingId,
              message:
                updateErr instanceof Error
                  ? updateErr.message
                  : String(updateErr),
            },
          );
        }
      }
    }

    const response: CheckoutSessionResponse = {
      booking_id: bookingId,
      booking_reference: bookingReference,
      amount,
      currency,
      gateway: PAYMENT_GATEWAY_CODE,
      payment_status: normalizedStatus,
      payment_stage: paymentStage,
      mock_mode: mockMode,
      reused,
      poll_interval_ms: 4000,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unexpected error";
    console.error("[checkout] unhandled exception", {
      raw,
      stack: err instanceof Error ? err.stack : undefined,
    });
    captureRouteError(err, { route: CHECKOUT_ROUTE, method: "POST" });
    return bad("Internal server error", 500, "UNHANDLED_EXCEPTION", { raw });
  }
}
