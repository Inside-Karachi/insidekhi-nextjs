import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/service";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import crypto from "crypto";

export async function POST(request: Request) {
  try {    // Check Auth
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { buyerDetails, items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Validate CNIC
    const rawCnic = buyerDetails?.cnic?.replace(/-/g, "") || "";
    if (!rawCnic || !/^\d{13}$/.test(rawCnic)) {
      return NextResponse.json(
        { error: "Valid CNIC is required" },
        { status: 400 },
      );
    }

    // Generate CNIC hash and last 4 digits
    const cnicHash = crypto.createHash("sha256").update(rawCnic).digest("hex");
    const cnicLast4 = rawCnic.slice(-4);

    // Generate verification seed (24 chars hex)
    const verificationSeed = crypto.randomBytes(12).toString("hex");

    // Generate booking reference in IK-XXXX-XXX format (branded, short, unique)
    // Uses base36 (0-9, A-Z) for compact representation
    // First part: 4 chars from timestamp (unique per millisecond)
    // Second part: 3 chars random (prevents collision within same ms)
    const timestampPart = Date.now().toString(36).slice(-4).toUpperCase();
    const randomPart = crypto
      .randomBytes(2)
      .toString("hex")
      .slice(0, 3)
      .toUpperCase();
    const bookingReference = `IK-${timestampPart}-${randomPart}`;

    // Use service role for transaction to ensure all writes succeed
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Re-fetch ticket prices server-side; never trust client-supplied prices.
    const ticketTypeIds = items.map(
      (i: { ticketTypeId: number }) => i.ticketTypeId,
    );
    const { data: ticketTypes } = await adminSupabase
      .from("ticket_types")
      .select("id, price, event_id")
      .in("id", ticketTypeIds);

    if (!ticketTypes) {
      return NextResponse.json({ error: "Invalid tickets" }, { status: 400 });
    }

    let subtotal = 0;
    const verifiedItems = items.map(
      (item: { ticketTypeId: number; quantity: number }) => {
        const tt = ticketTypes.find((t) => t.id === item.ticketTypeId);
        if (!tt) throw new Error(`Invalid ticket type: ${item.ticketTypeId}`);
        subtotal += tt.price * item.quantity;
        return { ...item, price: tt.price, eventId: tt.event_id };
      },
    );

    // Validate all items belong to the same event (RPC only supports single event)
    const uniqueEventIds = [
      ...new Set(verifiedItems.map((i: { eventId: number }) => i.eventId)),
    ];
    if (uniqueEventIds.length > 1) {
      return NextResponse.json(
        {
          error:
            "All tickets in a booking must be for the same event. Please create separate bookings for different events.",
        },
        { status: 400 },
      );
    }

    // Fetch platform and payment fees from server config (never trust client-supplied fees)
    const { data: feeConfigs } = await adminSupabase
      .from("system_config")
      .select("config_key, config_value")
      .in("config_key", [
        "fees.platform_fee_fixed",
        "fees.platform_fee_percentage",
        "fees.payment_processing_fee_fixed",
        "fees.payment_processing_fee_percentage",
      ]);

    const feeMap: Record<string, number> = {};
    for (const row of feeConfigs ?? []) {
      const v = row.config_value;
      feeMap[row.config_key] =
        typeof v === "number"
          ? v
          : typeof v === "string"
            ? parseFloat(v) || 0
            : 0;
    }
    const platformFeeFixed = feeMap["fees.platform_fee_fixed"] ?? 0;
    const platformFeePercentage = feeMap["fees.platform_fee_percentage"] ?? 0;
    const paymentFeeFixed = feeMap["fees.payment_processing_fee_fixed"] ?? 0;
    const paymentFeePercentage =
      feeMap["fees.payment_processing_fee_percentage"] ?? 0;

    const platformFee =
      platformFeeFixed + subtotal * (platformFeePercentage / 100);
    const paymentFee =
      paymentFeeFixed + (subtotal + platformFee) * (paymentFeePercentage / 100);
    const totalAmount = subtotal + platformFee + paymentFee;

    // 2. Create Booking + Booking Items atomically via DB function.
    // The RPC wraps both inserts in a single PL/pgSQL transaction -
    // if booking_items insertion fails, the booking row is also rolled back.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const rpcItems = verifiedItems.map(
      (item: { ticketTypeId: number; quantity: number; price: number }) => ({
        ticket_type_id: item.ticketTypeId,
        quantity: item.quantity,
        price_per_ticket: item.price,
      }),
    );

    // create_booking_atomic is defined in sql/migrations/20260311_security_atomic_booking_rpc.sql.
    // Cast through unknown because the function is not yet in the generated Supabase types.
    // Re-generate types with `npx supabase gen types typescript` after running the migration.
    interface BookingAtomicResult {
      booking_id: number;
      booking_reference: string;
    }
    const typedRpc = adminSupabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{
        data: BookingAtomicResult | null;
        error: { message: string } | null;
      }>;
    };

    const { data: rpcResult, error: bookingError } = await typedRpc.rpc(
      "create_booking_atomic",
      {
        p_user_id: session.userId,
        p_event_id: verifiedItems[0].eventId,
        p_total_amount: totalAmount,
        p_basket_id: bookingReference,
        p_booking_reference: bookingReference,
        p_verification_seed: verificationSeed,
        p_expires_at: expiresAt,
        p_cnic_hash: cnicHash,
        p_cnic_last4: cnicLast4,
        p_customer_name: buyerDetails.name,
        p_customer_email: buyerDetails.email,
        p_customer_phone: buyerDetails.phone,
        p_items: rpcItems,
      },
    );

    if (bookingError || !rpcResult) {
      console.error("Booking creation failed:", bookingError);
      captureRouteError(
        bookingError ?? new Error("Booking RPC returned no result"),
        {
          route: "/api/bookings/create",
          method: "POST",
        },
      );
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 },
      );
    }

    const bookingId = (rpcResult as { booking_id: number }).booking_id;

    // 3. Create Ticket Passes (non-fatal - will be regenerated by payment callback if needed)
    const ticketPasses = [];

    for (const item of verifiedItems) {
      for (let i = 0; i < item.quantity; i++) {
        const guest =
          (
            item as {
              guestInfo?: Record<number, { name?: string; cnic?: string }>;
            }
          ).guestInfo?.[i] || {};
        const guestCnicRaw = guest.cnic?.replace(/-/g, "") || null;
        const guestCnicLast4 = guestCnicRaw ? guestCnicRaw.slice(-4) : null;

        const ticketCode = `IK-${crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase()}`;

        const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
        if (!SIGNING_SECRET) {
          throw new Error(
            "TICKET_SIGNING_SECRET environment variable is not configured",
          );
        }
        const signature = crypto
          .createHmac("sha256", SIGNING_SECRET)
          .update(`${ticketCode}:${item.eventId}:${bookingId}`)
          .digest("hex")
          .slice(0, 16);

        ticketPasses.push({
          booking_id: bookingId,
          event_id: item.eventId,
          ticket_type_id: item.ticketTypeId,
          code: ticketCode,
          signature,
          status: "issued" as const,
          quantity_index: i,
          guest_name: guest.name || null,
          // guest_cnic intentionally omitted - do not persist plaintext national ID
          cnic_last4: guestCnicLast4,
        });
      }
    }

    // Insert ticket passes (non-fatal)
    if (ticketPasses.length > 0) {
      const { error: passesError } = await adminSupabase
        .from("ticket_passes")
        .insert(ticketPasses);

      if (passesError) {
        console.error("Ticket passes creation failed:", passesError);
        // Non-fatal - passes will be regenerated by payment callback
      }
    }

    // === SEND NOTIFICATION: Booking Created (Pending Payment) ===
    try {
      const { data: event } = await adminSupabase
        .from("events")
        .select("name")
        .eq("id", verifiedItems[0].eventId)
        .single();

      const eventName = event?.name || "your event";

      await createNotification(
        {
          recipientId: session.userId,
          roleScope: "public_user",
          categorySlug: "public_booking_status",
          title: "⏳ Booking Created - Complete Payment",
          body: `Your booking for ${eventName} is reserved. Complete payment within 30 minutes to secure your tickets.`,
          priority: "normal",
          ctaLabel: "Complete Payment",
          ctaUrl: `/checkout/payment?bookingId=${bookingId}`,
          metadata: {
            booking_id: bookingId,
            booking_reference: bookingReference,
            event_name: eventName,
            total_amount: totalAmount,
            expires_at: expiresAt,
          },
          channelOverrides: {
            bell: true,
            email: false,
            push: false,
          },
        },
        { supabase: adminSupabase },
      );

      console.log(`Booking pending notification sent for booking ${bookingId}`);
    } catch (notifError) {
      console.error("Failed to send booking notification:", notifError);
    }

    return NextResponse.json({ bookingId });
  } catch (error: unknown) {
    console.error("Booking API Error:", error);
    captureRouteError(error, { route: "/api/bookings/create", method: "POST" });
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
