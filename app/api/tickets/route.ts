import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// NOTE: This legacy endpoint is deprecated for booking creation.
// New flow: POST /api/tickets/checkout (uses transactional RPC + payment initiation)
// We retain GET for listing bookings; POST now returns 410 with guidance.

// (Interface removed; legacy path no longer supported.)

export async function POST() {
  return NextResponse.json(
    {
      error: "DEPRECATED_ENDPOINT",
      message:
        "Use POST /api/tickets/checkout with CNIC + tickets to initiate a booking and payment session.",
    },
    { status: 410 }
  );
}

// Get user's bookings
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { rows: bookings } = await query(
      `SELECT b.*,
              json_build_object(
                'name', e.name,
                'slug', e.slug,
                'start_time', e.start_time
              ) AS events
       FROM bookings b
       INNER JOIN events e ON e.id = b.event_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [session.userId]
    );

    const bookingIds = bookings.map((b) => b.id as number);
    let itemsByBooking = new Map<number, unknown[]>();
    if (bookingIds.length > 0) {
      const { rows: items } = await query(
        `SELECT bi.*,
                json_build_object('name', tt.name, 'price', tt.price) AS ticket_types
         FROM booking_items bi
         INNER JOIN ticket_types tt ON tt.id = bi.ticket_type_id
         WHERE bi.booking_id = ANY($1::int[])`,
        [bookingIds]
      );
      itemsByBooking = items.reduce((map, item) => {
        const bookingId = item.booking_id as number;
        const list = map.get(bookingId) ?? [];
        list.push(item);
        map.set(bookingId, list);
        return map;
      }, new Map<number, unknown[]>());
    }

    const result = bookings.map((b) => ({
      ...b,
      booking_items: itemsByBooking.get(b.id as number) ?? [],
    }));

    return NextResponse.json({ bookings: result });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
