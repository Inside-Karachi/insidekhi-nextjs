import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { PublicPass } from "@/types/ticketing.types";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const bookingIdParam = url.searchParams.get("booking_id");
    if (!bookingIdParam) {
      return NextResponse.json(
        { error: "booking_id required" },
        { status: 400 }
      );
    }
    const bookingId = Number(bookingIdParam);
    if (Number.isNaN(bookingId)) {
      return NextResponse.json(
        { error: "invalid booking_id" },
        { status: 400 }
      );
    }

    const session = await getSession(req);
    if (!session)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Fetch booking to enforce ownership
    const { rows: bookingRows } = await query(
      `SELECT id, user_id, booking_reference, payment_status, total_amount
       FROM bookings
       WHERE id = $1`,
      [bookingId]
    );
    const booking = bookingRows[0];
    if (!booking)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    if (booking.user_id !== session.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const paidStatuses = ["paid", "confirmed", "completed"];
    const isPaid = paidStatuses.includes(booking.payment_status ?? "");

    // Passes - only return full data (including codes) when payment is confirmed
    const { rows: passes } = await query(
      `SELECT id, booking_id, code, status, quantity_index, issued_at, ticket_type_id
       FROM ticket_passes
       WHERE booking_id = $1
       ORDER BY quantity_index ASC`,
      [bookingId]
    );

    const safePasses = isPaid
      ? ((passes || []) as PublicPass[])
      : (passes || []).map(({ code: _code, ...rest }) => rest) as PublicPass[];

    const result = {
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      payment_status: booking.payment_status,
      total_amount: booking.total_amount,
      passes: safePasses,
    };

    return NextResponse.json(result);
  } catch (_e) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
