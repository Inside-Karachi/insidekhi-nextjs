import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import {
  enforceMobileRateLimit,
  enforceCheckoutRateLimit,
} from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { parsePathId } from "@/lib/mobile/params";
import {
  fetchResumableBooking,
  rearmBooking,
  resumeBlockMessage,
  type ResumeBlockReason,
} from "@/lib/checkout/resume";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<Record<string, string>> };

/** Block reasons that mean "gone for good" (410) rather than "not allowed" (400). */
const GONE_REASONS: ResumeBlockReason[] = ["window_lapsed", "expired_status"];

const ERROR_CODES: Record<ResumeBlockReason, string> = {
  already_paid: "already_paid",
  refunded: "booking_refunded",
  cancelled: "booking_cancelled",
  expired_status: "resume_window_lapsed",
  window_lapsed: "resume_window_lapsed",
  sale_closed: "sale_closed",
  sold_out: "sold_out",
  event_unpublished: "event_unavailable",
};

/**
 * POST /api/mobile/v1/bookings/{id}/resume-payment
 *
 * Re-arms an unpaid booking so the caller can retry payment without creating a
 * duplicate. Owner-scoped (-> 404). Returns the same redacted preview DTO as
 * `/checkout/resumable`, so the client can render the order it is about to pay
 * for without a second round trip.
 *
 * Eligibility is decided by `lib/checkout/resume`, shared with the website.
 * Note the window is measured from `created_at`, NOT `expires_at`: this route
 * previously 410'd once the 15-minute payment hold lapsed, which made it
 * useless for its own purpose - `payments/token` would tell the user to
 * "resume it before paying" while this route refused to resume it.
 */
export const POST = mobileRoute(
  async (request: NextRequest, context: RouteContext) => {
    await enforceMobileRateLimit(request);
    const { user } = await requireMobileUser(request);
    // Re-arming a payment is a checkout-tier action, not a read.
    await enforceCheckoutRateLimit(user.id);

    const { id } = await context.params;
    const bookingId = parsePathId(id, "id");

    const result = await fetchResumableBooking(user.id, {
      bookingId,
      // Mobile bookings already hold their stock - see fetchResumableBooking.
      checkInventory: false,
    });

    if (result.blocked) {
      throw new MobileApiError(
        ERROR_CODES[result.blocked],
        resumeBlockMessage(result.blocked),
        GONE_REASONS.includes(result.blocked) ? 410 : 400,
      );
    }
    if (!result.booking) {
      throw new MobileApiError("not_found", "Booking not found.", 404);
    }

    let expiresAt: string;
    try {
      expiresAt = await rearmBooking(result.booking.booking_id);
    } catch (error) {
      console.error(
        "[mobile-api] resume-payment update failed:",
        error instanceof Error ? error.message : error,
      );
      throw new MobileApiError("internal_error", "Failed to resume payment.", 500);
    }

    return ok({ booking: { ...result.booking, expires_at: expiresAt } });
  },
);
