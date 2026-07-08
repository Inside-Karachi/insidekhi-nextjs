import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface EventRecord {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  max_capacity?: number | null;
  status: string;
  is_commission_based: boolean;
  commission_rate?: number | null;
  created_at: string;
  location_name?: string | null;
  address?: string | null;
}

interface BookingRecord {
  id: number;
  event_id: number | null;
  total_amount: number | string;
  status: string;
  created_at: string;
}

interface TicketTypeRecord {
  id: number;
  event_id: number;
  name: string;
  price: number | string;
  quantity_available: number | null;
}

interface TicketPassRecord {
  id: number;
  event_id: number;
  status: string;
  checked_in_at?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's events with stats
    let eventsQuery = supabase
      .from("events")
      .select(
        `
        id,
        name,
        slug,
        description,
        start_time,
        end_time,
        max_capacity,
        status,
        is_commission_based,
        commission_rate,
        created_at,
        location_name,
        address
      `,
      )
      .eq("organizer_id", user.id)
      .order("start_time", { ascending: false });

    if (eventId) {
      eventsQuery = eventsQuery.eq("id", parseInt(eventId, 10));
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error("Events fetch error:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 },
      );
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        events: [],
        summary: {
          totalEvents: 0,
          totalRevenue: 0,
          totalTicketsSold: 0,
          totalCheckIns: 0,
          upcomingEvents: 0,
          pastEvents: 0,
        },
      });
    }

    const eventIds = (events as EventRecord[]).map((e) => e.id);

    // Get bookings for these events - filter by payment_status = 'paid' for accurate revenue
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        event_id,
        total_amount,
        status,
        payment_status,
        created_at
      `,
      )
      .in("event_id", eventIds)
      .eq("payment_status", "paid");

    if (bookingsError) {
      console.error("Bookings fetch error:", bookingsError);
    }

    // Get ticket types for capacity info
    const { data: ticketTypes } = await supabase
      .from("ticket_types")
      .select("id, event_id, name, price, quantity_available")
      .in("event_id", eventIds);

    // Get check-in counts (from ticket_passes)
    const { data: ticketPasses } = await supabase
      .from("ticket_passes")
      .select("id, event_id, status, checked_in_at")
      .in("event_id", eventIds);

    // Calculate tickets sold from booking_items
    const { data: bookingItems } = await supabase
      .from("booking_items")
      .select("booking_id, ticket_type_id, quantity")
      .in(
        "ticket_type_id",
        ((ticketTypes as TicketTypeRecord[]) || []).map((t) => t.id),
      );

    // Build a map of ticket_type_id -> quantity sold
    const ticketsSoldByType: Record<number, number> = {};
    const confirmedBookingIds = ((bookings as BookingRecord[]) || []).map(
      (b) => b.id,
    );
    (bookingItems || []).forEach((item) => {
      if (confirmedBookingIds.includes(item.booking_id)) {
        ticketsSoldByType[item.ticket_type_id] =
          (ticketsSoldByType[item.ticket_type_id] || 0) + item.quantity;
      }
    });

    // Calculate per-event stats
    const eventsWithStats = (events as EventRecord[]).map((event) => {
      const eventBookings = ((bookings as BookingRecord[]) || []).filter(
        (b) => b.event_id === event.id,
      );
      const eventTicketTypes = (
        (ticketTypes as TicketTypeRecord[]) || []
      ).filter((t) => t.event_id === event.id);
      const eventPasses = ((ticketPasses as TicketPassRecord[]) || []).filter(
        (p) => p.event_id === event.id,
      );

      const ticketsSold = eventTicketTypes.reduce(
        (sum, t) => sum + (ticketsSoldByType[t.id] || 0),
        0,
      );
      const totalCapacity = eventTicketTypes.reduce(
        (sum, t) => sum + (t.quantity_available || 0),
        0,
      );
      const revenue = eventBookings.reduce(
        (sum, b) => sum + Number(b.total_amount || 0),
        0,
      );
      const checkIns = eventPasses.filter(
        (p) => p.status === "checked_in",
      ).length;

      const now = new Date();
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const isUpcoming = startTime > now;
      const isLive = startTime <= now && endTime >= now;

      return {
        ...event,
        stats: {
          ticketsSold,
          totalCapacity: totalCapacity || event.max_capacity || 0,
          revenue,
          checkIns,
          totalPasses: eventPasses.length,
          occupancyRate:
            totalCapacity > 0
              ? Math.round((ticketsSold / totalCapacity) * 100)
              : 0,
        },
        ticketTypes: eventTicketTypes.map((t) => ({
          id: t.id,
          name: t.name,
          price: Number(t.price),
          sold: ticketsSoldByType[t.id] || 0,
          available: t.quantity_available || 0,
        })),
        eventStatus: isLive ? "live" : isUpcoming ? "upcoming" : "past",
      };
    });

    // Calculate summary
    const now = new Date();
    const summary = {
      totalEvents: events.length,
      totalRevenue: eventsWithStats.reduce(
        (sum, e) => sum + e.stats.revenue,
        0,
      ),
      totalTicketsSold: eventsWithStats.reduce(
        (sum, e) => sum + e.stats.ticketsSold,
        0,
      ),
      totalCheckIns: eventsWithStats.reduce(
        (sum, e) => sum + e.stats.checkIns,
        0,
      ),
      upcomingEvents: (events as EventRecord[]).filter(
        (e) => new Date(e.start_time) > now,
      ).length,
      pastEvents: (events as EventRecord[]).filter(
        (e) => new Date(e.end_time) < now,
      ).length,
      liveEvents: (events as EventRecord[]).filter(
        (e) => new Date(e.start_time) <= now && new Date(e.end_time) >= now,
      ).length,
    };

    return NextResponse.json({
      events: eventsWithStats,
      summary,
    });
  } catch (error) {
    console.error("Organizer events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
