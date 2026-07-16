import { createServerSupabase } from "@/lib/supabase/server";
/**
 * Resume Payment API Route
 *
 * POST /api/bookings/[id]/resume-payment
 *
 * Allows users to retry payment for an existing booking without creating a new one.
 * This prevents redundant booking records during testing and real-world payment failures.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createServerSupabase();
  try {
    const { id } = await params;
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 }
      );
    }    // Check Auth
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Security: Verify ownership
    if (booking.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate booking is eligible for payment retry
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { error: "This booking has already been paid" },
        { status: 400 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "This booking has been cancelled" },
        { status: 400 }
      );
    }

    // Check if booking is expired
    if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
      return NextResponse.json(
        {
          error:
            "This booking has expired. Please create a new booking to proceed.",
        },
        { status: 410 }
      );
    }

    // Extend expiration by 30 minutes
    const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { error: updateError } = await adminSupabase
      .from("bookings")
      .update({
        expires_at: newExpiresAt,
        payment_status: "awaiting_payment", // Reset to awaiting_payment
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Failed to extend booking expiration:", updateError);
      return NextResponse.json(
        { error: "Failed to resume payment" },
        { status: 500 }
      );
    }

    // Return booking details for payment
    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        total_amount: booking.total_amount,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        expires_at: newExpiresAt,
      },
    });
  } catch (error: unknown) {
    console.error("Resume Payment API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
