import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deriveStateCode } from "@/lib/payments/status-map";
import { BookingPaymentStatus } from "@/types/payments.types";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const bookingIdParam = url.searchParams.get("booking_id");
  if (!bookingIdParam) {
    return NextResponse.json({ error: "booking_id required" }, { status: 400 });
  }
  const bookingId = Number(bookingIdParam);
  if (Number.isNaN(bookingId)) {
    return NextResponse.json(
      { error: "booking_id must be numeric" },
      { status: 400 }
    );
  }

  // Require authenticated session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Restrict by user_id to prevent IDOR
  const { rows: bookingRows } = await query(
    `SELECT id, booking_reference, payment_status
     FROM bookings WHERE id = $1 AND user_id = $2`,
    [bookingId, session.userId],
  );
  const booking = bookingRows[0];
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { rows: passRows } = await query(
    `SELECT COUNT(*)::int AS count FROM ticket_passes WHERE booking_id = $1`,
    [bookingId],
  );
  const passCount = passRows[0]?.count ?? 0;

  return NextResponse.json({
    booking_id: booking.id,
    booking_reference: booking.booking_reference,
    payment_status: booking.payment_status,
    passes_issued: !!passCount && passCount > 0,
    pass_count: passCount || 0,
    state_code: deriveStateCode(booking.payment_status as BookingPaymentStatus),
  });
}
