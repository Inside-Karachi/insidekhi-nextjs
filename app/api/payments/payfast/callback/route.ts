import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  validatePayFastCallback,
  normalizePayFastStatus,
  type PayFastCallbackParams,
} from "@/lib/payments/payfast";
import { createNotification } from "@/lib/notifications/service";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import crypto from "crypto";

// PayFast payment webhook: validates the callback signature, updates booking payment_status,
// creates ticket passes, and notifies the user.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    // Collect callback parameters from BOTH the query string and the request
    // body. PayFast's server-to-server IPN posts result fields as a
    // form-urlencoded (or multipart) body, while the browser return URL carries
    // them on the query string. Body values take precedence when both exist.
    const url = new URL(request.url);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const contentType = request.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const body = await request.json();
        if (body && typeof body === "object") {
          for (const [key, value] of Object.entries(body)) {
            if (value != null) {
              params[key] = String(value);
            }
          }
        }
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const form = await request.formData();
        for (const [key, value] of form.entries()) {
          params[key] = String(value);
        }
      }
    } catch {
      // If the body can't be parsed, fall back to query-string params only.
    }

    // Log the param KEYS (not values), joined so they're readable in Sentry/log
    // aggregators, to confirm the exact live field names on the first
    // production transaction.
    const receivedKeys = Object.keys(params);
    console.log("[PayFast Webhook] Received callback:", {
      paramKeys: receivedKeys.join(",") || "(none)",
      basket_id: params.basket_id,
      err_code: params.err_code,
      transaction_id: params.transaction_id,
    });

    // Guard malformed callbacks: empty body -> clean 400 (no Sentry noise); a populated body
    // missing expected fields is logged with its keys so parsing can be adapted.
    if (!params.basket_id || !params.err_code) {
      console.warn(
        "[PayFast Webhook] Missing basket_id/err_code. Keys:",
        receivedKeys.join(",") || "(none)",
      );
      if (receivedKeys.length > 0) {
        captureRouteError(
          new Error("PayFast callback missing basket_id/err_code"),
          {
            route: "/api/payments/payfast/callback",
            method: "POST",
            extra: { receivedKeys: receivedKeys.join(",") },
          },
        );
      }
      return NextResponse.json(
        { error: "Missing required callback parameters" },
        { status: 400 },
      );
    }

    // Validate callback signature
    const validation = validatePayFastCallback(params as PayFastCallbackParams);

    if (!validation.isValid) {
      console.error("[PayFast Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid callback signature" },
        { status: 401 },
      );
    }

    // Get normalized status
    const paymentStatus = normalizePayFastStatus(validation.errorCode);

    console.log("[PayFast Webhook] Payment status:", {
      errorCode: validation.errorCode,
      status: paymentStatus,
      basketId: validation.basketId,
    });

    // Find booking by basket_id (which is our booking_reference)
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, user_id, payment_status, event_id, booking_reference, customer_name, total_amount",
      )
      .eq("basket_id", validation.basketId)
      .single();

    if (bookingError || !booking) {
      console.error(
        "[PayFast Webhook] Booking not found:",
        validation.basketId,
      );
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // If already paid, skip processing
    if (booking.payment_status === "paid") {
      console.log("[PayFast Webhook] Booking already paid, skipping");
      return NextResponse.json({
        success: true,
        message: "Booking already processed",
      });
    }

    // Verify the reported amount (and currency, if present) against the booking before confirming.
    // Fail closed: a "paid" callback we cannot amount-verify must NOT confirm the booking.
    if (paymentStatus === "paid") {
      const reportedAmountRaw =
        params.transaction_amount ??
        params.TXNAMT ??
        params.txnamt ??
        params.amount ??
        params.AMOUNT;
      const reportedAmount =
        reportedAmountRaw != null ? parseFloat(reportedAmountRaw) : NaN;
      const expectedAmount = Number(booking.total_amount ?? 0);

      if (
        !Number.isFinite(reportedAmount) ||
        Math.abs(reportedAmount - expectedAmount) > 0.01
      ) {
        console.error("[PayFast Webhook] Amount verification failed:", {
          basketId: validation.basketId,
          expectedAmount,
          reportedAmountPresent: reportedAmountRaw != null,
          paramKeys: Object.keys(params),
        });
        captureRouteError(new Error("PayFast callback amount mismatch"), {
          route: "/api/payments/payfast/callback",
          method: "POST",
          extra: {
            stage: "amount_verification",
            bookingId: booking.id,
            expectedAmount,
            reportedAmountPresent: reportedAmountRaw != null,
          },
        });
        return NextResponse.json(
          { error: "Payment amount verification failed" },
          { status: 400 },
        );
      }

      const reportedCurrency =
        params.currency || params.CURRENCY_CODE || params.currency_code;
      if (reportedCurrency && reportedCurrency.toUpperCase() !== "PKR") {
        console.error(
          "[PayFast Webhook] Currency verification failed:",
          reportedCurrency,
        );
        return NextResponse.json(
          { error: "Payment currency verification failed" },
          { status: 400 },
        );
      }
    }

    // Map PayFast status to booking status
    const bookingPaymentStatus =
      paymentStatus === "paid"
        ? "paid"
        : paymentStatus === "pending"
          ? "pending"
          : "failed";

    // Record payment event idempotently.
    // ON CONFLICT DO NOTHING means duplicate webhooks for the same transaction
    // produce no additional rows - the unique index on provider_transaction_id
    // (migration 20260311_security_payment_idempotency_index.sql) enforces this.
    if (validation.transactionId) {
      await supabase.from("payments").upsert(
        {
          booking_id: booking.id,
          gateway_code: "payfast",
          amount: booking.total_amount ?? 0,
          currency: "PKR",
          status: bookingPaymentStatus,
          normalized_status: bookingPaymentStatus,
          provider_transaction_id: validation.transactionId,
          raw_request: params as Record<string, string>,
        },
        { onConflict: "provider_transaction_id", ignoreDuplicates: true },
      );
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        payment_status: bookingPaymentStatus,
        status: bookingPaymentStatus === "paid" ? "confirmed" : "pending",
      })
      .eq("id", booking.id);

    if (updateError) {
      console.error("[PayFast Webhook] Failed to update booking:", updateError);
      captureRouteError(updateError, {
        route: "/api/payments/payfast/callback",
        method: "POST",
        extra: { stage: "update_booking", bookingId: booking.id },
      });
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 },
      );
    }

    // If payment successful, create ticket passes
    let passesCreated = 0;
    if (bookingPaymentStatus === "paid" && booking.event_id) {
      try {
        // Get booking items
        const { data: bookingItems } = await supabase
          .from("booking_items")
          .select("ticket_type_id, quantity")
          .eq("booking_id", booking.id);

        if (bookingItems && bookingItems.length > 0) {
          const passesToCreate = [];
          const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
          if (!SIGNING_SECRET) {
            throw new Error(
              "TICKET_SIGNING_SECRET environment variable is not configured",
            );
          }

          for (const item of bookingItems) {
            for (let i = 0; i < item.quantity; i++) {
              const code = `IK-${crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase()}`;
              const signature = crypto
                .createHmac("sha256", SIGNING_SECRET)
                .update(`${code}:${booking.event_id}:${booking.id}`)
                .digest("hex")
                .slice(0, 16);

              passesToCreate.push({
                booking_id: booking.id,
                event_id: booking.event_id,
                ticket_type_id: item.ticket_type_id,
                code,
                signature,
                status: "issued" as const,
                quantity_index: i,
                guest_name: booking.customer_name || `Guest ${i + 1}`,
              });
            }
          }

          if (passesToCreate.length > 0) {
            // Check if passes already exist to avoid duplicates
            const { data: existingPasses } = await supabase
              .from("ticket_passes")
              .select("id")
              .eq("booking_id", booking.id)
              .limit(1);

            if (!existingPasses || existingPasses.length === 0) {
              const { data: createdPasses, error: passesError } = await supabase
                .from("ticket_passes")
                .insert(passesToCreate)
                .select("id");

              if (!passesError && createdPasses) {
                passesCreated = createdPasses.length;
                console.log(
                  `[PayFast Webhook] Created ${passesCreated} ticket passes`,
                );
              } else {
                console.error(
                  "[PayFast Webhook] Failed to create passes:",
                  passesError,
                );
              }
            } else {
              console.log(
                "[PayFast Webhook] Passes already exist for booking, skipping creation",
              );
            }
          }
        }
      } catch (passError) {
        console.error("[PayFast Webhook] Error creating passes:", passError);
      }
    }

    // Record in booking status history
    try {
      await supabase.from("booking_status_history").insert({
        booking_id: booking.id,
        old_status: booking.payment_status,
        new_status: bookingPaymentStatus,
        context: `PayFast webhook: ${validation.errorCode} - ${
          validation.errorMessage || "Success"
        }. Transaction: ${validation.transactionId || "N/A"}`,
      });
    } catch {
      // Ignore if history table doesn't exist
    }

    // Send notification if payment successful
    if (
      bookingPaymentStatus === "paid" &&
      booking.user_id &&
      booking.event_id
    ) {
      try {
        const { data: eventData } = await supabase
          .from("events")
          .select("name")
          .eq("id", booking.event_id)
          .single();

        const eventName = eventData?.name || "your event";

        const notificationResult = await createNotification(
          {
            recipientId: booking.user_id,
            roleScope: "public_user",
            categorySlug: "public_booking_confirmation",
            title: "🎉 Payment Confirmed!",
            body: `Your tickets for ${eventName} are ready. ${passesCreated} pass${
              passesCreated !== 1 ? "es" : ""
            } issued.`,
            priority: "high",
            ctaLabel: "View My Tickets",
            ctaUrl: `/dashboard/bookings`,
            metadata: {
              booking_id: booking.id,
              booking_reference: booking.booking_reference,
              event_name: eventName,
              passes_count: passesCreated,
              transaction_id: validation.transactionId,
            },
            channelOverrides: {
              bell: true,
              email: true,
              push: false,
            },
          },
          { supabase },
        );

        console.log(
          `[PayFast Webhook] Notification sent to user ${booking.user_id}`,
        );

        // Dispatch emails immediately
        if (notificationResult.outbox.length > 0) {
          try {
            const dispatchModule =
              await import("@/lib/notifications/dispatcher");
            await dispatchModule.dispatchEmailOutboxBatch({
              supabase,
              limit: 10,
            });
            console.log("[PayFast Webhook] Emails dispatched");
          } catch (dispatchError) {
            console.error(
              "[PayFast Webhook] Email dispatch failed:",
              dispatchError,
            );
          }
        }
      } catch (notifError) {
        console.error(
          "[PayFast Webhook] Failed to send notification:",
          notifError,
        );
      }
    }

    // Send failure notification if payment failed
    if (
      bookingPaymentStatus === "failed" &&
      booking.user_id &&
      booking.event_id
    ) {
      try {
        const { data: eventData } = await supabase
          .from("events")
          .select("name")
          .eq("id", booking.event_id)
          .single();

        const eventName = eventData?.name || "your event";

        const notificationResult = await createNotification(
          {
            recipientId: booking.user_id,
            roleScope: "public_user",
            categorySlug: "public_booking_status",
            title: "❌ Payment Failed",
            body: `Your payment for ${eventName} could not be completed. ${
              validation.errorMessage || "Please try again."
            }`,
            priority: "high",
            ctaLabel: "Retry Payment",
            ctaUrl: `/checkout/payment?bookingId=${booking.id}`,
            metadata: {
              booking_id: booking.id,
              booking_reference: booking.booking_reference,
              event_name: eventName,
              error_code: validation.errorCode,
              error_message: validation.errorMessage,
            },
            channelOverrides: {
              bell: true,
              email: true,
              push: false,
            },
          },
          { supabase },
        );

        console.log(
          `[PayFast Webhook] Failure notification sent to user ${booking.user_id}`,
        );

        // Dispatch failure emails immediately
        if (notificationResult.outbox.length > 0) {
          try {
            const dispatchModule =
              await import("@/lib/notifications/dispatcher");
            await dispatchModule.dispatchEmailOutboxBatch({
              supabase,
              limit: 10,
            });
            console.log("[PayFast Webhook] Failure emails dispatched");
          } catch (dispatchError) {
            console.error(
              "[PayFast Webhook] Failure email dispatch failed:",
              dispatchError,
            );
          }
        }
      } catch (notifError) {
        console.error(
          "[PayFast Webhook] Failed to send failure notification:",
          notifError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment status updated successfully",
      bookingId: booking.id,
      paymentStatus: bookingPaymentStatus,
      passesCreated,
    });
  } catch (error) {
    console.error("[PayFast Webhook] Unexpected error:", error);
    captureRouteError(error, {
      route: "/api/payments/payfast/callback",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Handle GET requests (for testing)
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: "PayFast webhook endpoint is active",
    method: "POST",
    note: "This endpoint receives payment callbacks from PayFast",
  });
}
