import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  fetchResumableBooking,
  resumeBlockMessage,
  RESUME_WINDOW_MINUTES,
} from "@/lib/checkout/resume";

export const dynamic = "force-dynamic";

/**
 * GET /api/checkout/resumable
 *
 * The signed-in user's most recent resumable booking, as a redacted preview,
 * so checkout can offer "resume this payment" instead of stranding them with an
 * empty cart after a failed attempt.
 *
 * Replaces `/api/checkout/pending-booking`, which could never surface the case
 * that actually matters: it filtered `payment_status IN ('awaiting_payment',
 * 'pending')` and so was blind to `failed` bookings.
 *
 * Query params (all optional):
 *   ?eventIds=1,2   narrow to the event(s) currently being bought
 *   ?bookingReference=IK-…   targeted lookup, used by the failure screen
 *
 * Scoped to the session user's own bookings - an id from the request is never
 * trusted on its own.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ booking: null });
    }

    const { searchParams } = new URL(request.url);

    const bookingReference = searchParams.get("bookingReference") ?? undefined;

    const idsParam = searchParams.get("eventIds");
    const eventIds = idsParam
      ? idsParam
          .split(",")
          .map((id) => parseInt(id, 10))
          .filter((id) => !Number.isNaN(id))
      : undefined;

    const result = await fetchResumableBooking(session.userId, {
      bookingReference,
      eventIds: eventIds?.length ? eventIds : undefined,
      // The website's booking path (`create_booking_atomic`) never reserves
      // stock, so resuming is a real claim on live inventory and must be
      // re-checked. See the note on `fetchResumableBooking`.
      checkInventory: true,
    });

    if (result.blocked) {
      return NextResponse.json({
        booking: null,
        blocked_reason: result.blocked,
        message: resumeBlockMessage(result.blocked),
      });
    }

    return NextResponse.json({
      booking: result.booking,
      resume_window_minutes: RESUME_WINDOW_MINUTES,
    });
  } catch (error) {
    console.error("Checkout resumable API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
