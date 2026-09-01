/**
 * Resume Payment API Route
 *
 * POST /api/bookings/[id]/resume-payment
 *
 * Re-arms an existing unpaid booking so the user can retry payment without
 * creating a duplicate booking record. Returns the same redacted preview DTO as
 * `/api/checkout/resumable`, so the caller can render what it is about to pay
 * for without a second round trip.
 *
 * Eligibility lives in `lib/checkout/resume`, shared with the mobile API.
 * Note the window is measured from `created_at`, NOT `expires_at`: this route
 * used to 410 as soon as the payment hold lapsed, which made it useless for the
 * very case it exists to serve.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  fetchResumableBooking,
  rearmBooking,
  resumeBlockMessage,
  type ResumeBlockReason,
} from "@/lib/checkout/resume";

export const dynamic = "force-dynamic";

/** Reasons that mean "gone for good" (410) rather than "not allowed" (400). */
const GONE_REASONS: ResumeBlockReason[] = ["window_lapsed", "expired_status"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (Number.isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Owner-scoped in-query: a booking belonging to someone else is simply not
    // found, rather than a 403 that confirms it exists.
    const result = await fetchResumableBooking(session.userId, {
      bookingId,
      // The website's booking path never reserved stock, so resuming is a real
      // claim on live inventory - see fetchResumableBooking.
      checkInventory: true,
    });

    if (result.blocked) {
      return NextResponse.json(
        {
          error: resumeBlockMessage(result.blocked),
          blocked_reason: result.blocked,
        },
        { status: GONE_REASONS.includes(result.blocked) ? 410 : 400 }
      );
    }
    if (!result.booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    let expiresAt: string;
    try {
      expiresAt = await rearmBooking(result.booking.booking_id);
    } catch (updateError) {
      console.error("Failed to re-arm booking for payment:", updateError);
      return NextResponse.json(
        { error: "Failed to resume payment" },
        { status: 500 }
      );
    }

    // Redacted: customer_email / customer_phone are deliberately absent, unlike
    // the previous version of this route.
    return NextResponse.json({
      success: true,
      booking: { ...result.booking, expires_at: expiresAt },
    });
  } catch (error: unknown) {
    console.error("Resume Payment API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
