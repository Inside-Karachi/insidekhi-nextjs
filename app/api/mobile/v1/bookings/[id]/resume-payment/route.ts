import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { parsePathId } from "@/lib/mobile/params";
import { createMobileServiceClient } from "@/lib/mobile/supabase";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * POST /api/mobile/v1/bookings/{id}/resume-payment
 *
 * Re-arms an unpaid booking (extends `expires_at` +30min, resets to
 * `awaiting_payment`) so the caller can retry payment without creating a new
 * booking. Owner-scoped in-query (-> 404). Already paid / cancelled -> 400;
 * expired -> 410. The bookings UPDATE is service_role-only, so it runs through a
 * service client after the ownership + state checks. Redacted response (no
 * email/phone). Mirrors `app/api/bookings/[id]/resume-payment`.
 */
export const POST = mobileRoute(
  async (request: NextRequest, context: RouteContext) => {
    await enforceMobileRateLimit(request);
    const { user, supabase } = await requireMobileUser(request);
    await enforceMobileRateLimit(request, user.id);

    const { id } = await context.params;
    const bookingId = parsePathId(id, "id");

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select(
        "id, booking_reference, total_amount, customer_name, status, payment_status, expires_at",
      )
      .eq("id", bookingId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (bErr) {
      console.error("[mobile-api] resume booking lookup failed:", bErr.message);
      throw new MobileApiError(
        "internal_error",
        "Failed to resume payment.",
        500,
      );
    }
    if (!booking) {
      throw new MobileApiError("not_found", "Booking not found.", 404);
    }
    if (booking.payment_status === "paid") {
      throw new MobileApiError(
        "already_paid",
        "This booking has already been paid.",
        400,
      );
    }
    if (booking.payment_status === "refunded") {
      throw new MobileApiError(
        "booking_refunded",
        "This booking has been refunded and cannot be paid again.",
        400,
      );
    }
    if (booking.status === "cancelled") {
      throw new MobileApiError(
        "booking_cancelled",
        "This booking has been cancelled.",
        400,
      );
    }
    if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
      throw new MobileApiError(
        "booking_expired",
        "This booking has expired. Please create a new booking.",
        410,
      );
    }

    const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const service = createMobileServiceClient();
    const { error } = await service
      .from("bookings")
      .update({ expires_at: newExpiresAt, payment_status: "awaiting_payment" })
      .eq("id", bookingId);
    if (error) {
      console.error(
        "[mobile-api] resume-payment update failed:",
        error.message,
      );
      throw new MobileApiError(
        "internal_error",
        "Failed to resume payment.",
        500,
      );
    }

    return ok({
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        total_amount: booking.total_amount,
        customer_name: booking.customer_name,
        expires_at: newExpiresAt,
      },
    });
  },
);
