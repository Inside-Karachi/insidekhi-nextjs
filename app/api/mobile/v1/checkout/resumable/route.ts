import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import {
  fetchResumableBooking,
  resumeBlockMessage,
  RESUME_WINDOW_MINUTES,
} from "@/lib/checkout/resume";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/checkout/resumable
 *
 * The caller's most recent resumable booking, as a redacted preview. Mobile
 * mirror of the website's `/api/checkout/resumable`, sharing `lib/checkout/resume`
 * so the two surfaces can't drift.
 *
 * This is what makes resume possible on a client that persists nothing: the
 * app's cart is in-memory only and its buyer store is deliberately never
 * written to disk, so after a kill the *server* is the only thing that
 * remembers what was being bought. Discovery is keyed on the bearer token.
 *
 * Optional `?event_id=` narrows to a single event; `?booking_reference=` does a
 * targeted lookup for the failure screen.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);

  const bookingReference = searchParams.get("booking_reference") ?? undefined;

  const eventIdParam = searchParams.get("event_id");
  const eventId = eventIdParam ? parseInt(eventIdParam, 10) : NaN;

  const result = await fetchResumableBooking(user.id, {
    bookingReference,
    eventIds: Number.isNaN(eventId) ? undefined : [eventId],
    // Mobile bookings already hold their stock: `create_booking_with_reservation`
    // decrements `quantity_available` at creation and nothing restores it, so
    // re-checking here would block the user against their own reservation.
    checkInventory: false,
  });

  if (result.blocked) {
    return ok({
      booking: null,
      blocked_reason: result.blocked,
      message: resumeBlockMessage(result.blocked),
      resume_window_minutes: RESUME_WINDOW_MINUTES,
    });
  }

  return ok({
    booking: result.booking,
    blocked_reason: null,
    message: null,
    resume_window_minutes: RESUME_WINDOW_MINUTES,
  });
});
