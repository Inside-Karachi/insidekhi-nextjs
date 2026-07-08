import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
export async function GET() {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        events!inner(name, slug, start_time),
        booking_items(
          *,
          ticket_types(name, price)
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings: bookings || [] });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
