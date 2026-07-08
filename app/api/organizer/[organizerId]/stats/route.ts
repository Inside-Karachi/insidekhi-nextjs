import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

// GET /api/organizer/[organizerId]/stats - Get organizer stats and recent events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizerId: string }> },
) {
  try {
    const supabase = await createServerSupabase();
    const { organizerId } = await params;

    // Fetch organizer profile
    const { data: organizer, error: organizerError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, username, phone, role, is_verified_organizer, organizer_bio, organizer_company, organizer_website",
      )
      .eq("id", organizerId)
      .single();

    if (organizerError || !organizer) {
      return NextResponse.json(
        { success: false, error: "Organizer not found" },
        { status: 404 },
      );
    }

    // Get all events by organizer
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, name, slug, start_time, end_time, status")
      .eq("organizer_id", organizerId)
      .eq("status", "published")
      .order("start_time", { ascending: false });

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
    }

    const allEvents = events || [];
    const eventsOrganized = allEvents.length;

    // Get recent 3 events (already sorted by start_time descending)
    // This includes both ongoing and past events
    const recentEvents = allEvents.slice(0, 3);

    // Get total attendees (sum of booking item quantities)
    const { data: bookingIds } = await supabase
      .from("bookings")
      .select("id")
      .eq("organizer_id", organizerId)
      .eq("status", "completed");

    let totalAttendees = 0;
    if (bookingIds && bookingIds.length > 0) {
      const { data: ticketData } = await supabase
        .from("booking_items")
        .select("quantity")
        .in(
          "booking_id",
          bookingIds.map((b) => b.id),
        );

      totalAttendees =
        ticketData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    }

    // Events are self-contained and carry no reviews, so there is no organizer
    // rating. Surface a real metric instead: count of upcoming events.
    const now = new Date();
    const upcomingEvents = allEvents.filter(
      (e) => new Date(e.start_time) > now,
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        organizer: {
          id: organizer.id,
          full_name: organizer.full_name,
          avatar_url: organizer.avatar_url,
          username: organizer.username,
          phone: organizer.phone,
          role: organizer.role,
          isVerified: organizer.is_verified_organizer || false,
          bio: organizer.organizer_bio,
          company: organizer.organizer_company,
          website: organizer.organizer_website,
        },
        stats: {
          eventsOrganized,
          totalAttendees,
          upcomingEvents,
        },
        recentEvents: recentEvents.map((e) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          start_time: e.start_time,
          end_time: e.end_time,
        })),
      },
    });
  } catch (error) {
    console.error("Error in organizer stats GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
