import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: bookingRows } = await query(
      `SELECT * FROM bookings WHERE id = $1`,
      [parseInt(id)]
    );
    const booking = bookingRows[0];

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Ownership check - admins can view any booking
    if (booking.user_id !== session.userId) {
      const { rows: profileRows } = await query(
        `SELECT role FROM profiles WHERE id = $1`,
        [session.userId]
      );
      const profile = profileRows[0];
      const isAdmin =
        profile?.role === "admin" || profile?.role === "super_admin";
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // node-pg returns numeric columns as strings - normalize before sending
    // to the client, which does arithmetic (e.g. amount.toFixed(2)) on this.
    return NextResponse.json({
      ...booking,
      total_amount: Number(booking.total_amount),
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}
