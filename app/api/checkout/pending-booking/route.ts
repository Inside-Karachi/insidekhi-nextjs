import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// Returns the logged-in user's most recent still-pending booking for any of
// the given event ids, so the checkout page can offer to resume it instead
// of creating a duplicate booking. Scoped to the session user's own bookings
// (Section 8 of the migration guide) - never trusts an id from the request.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ booking: null });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("eventIds");
    if (!idsParam) {
      return NextResponse.json({ booking: null });
    }

    const eventIds = idsParam
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));

    if (eventIds.length === 0) {
      return NextResponse.json({ booking: null });
    }

    const { rows } = await query(
      `SELECT id, booking_reference, total_amount, event_id,
              to_json(expires_at) #>> '{}' AS expires_at
       FROM bookings
       WHERE user_id = $1 AND event_id = ANY($2) AND payment_status::text = ANY($3::text[])
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.userId, eventIds, ["awaiting_payment", "pending"]],
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ booking: null });
    }

    return NextResponse.json({
      booking: {
        id: Number(row.id),
        booking_reference: row.booking_reference,
        total_amount:
          row.total_amount !== null ? Number(row.total_amount) : null,
        event_id: row.event_id !== null ? Number(row.event_id) : null,
        expires_at: row.expires_at,
      },
    });
  } catch (error) {
    console.error("Checkout pending-booking API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
