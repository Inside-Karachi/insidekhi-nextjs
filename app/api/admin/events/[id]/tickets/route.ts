import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Force dynamic to ensure fresh ticket data
export const dynamic = "force-dynamic";

// GET /api/admin/events/[id]/tickets - Get all ticket types for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if user has admin or lister role
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Verify event exists and user has access
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    // Get ticket types for the event
    const { data: ticketTypes, error: ticketsError } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("event_id", eventId)
      .order("sale_starts_at", { ascending: true });

    if (ticketsError) {
      console.error("Error fetching ticket types:", ticketsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch ticket types" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ticket_types: ticketTypes || [],
      },
    });
  } catch (error) {
    console.error("Error in admin tickets GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/events/[id]/tickets - Create new ticket type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if user has admin or lister role
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, organizer_id, start_time, end_time")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      price,
      quantity_available,
      sale_starts_at,
      sale_ends_at,
      max_per_person,
    } = body;

    // Validation
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Ticket name is required" },
        { status: 400 }
      );
    }

    if (typeof price !== "number" || price < 0) {
      return NextResponse.json(
        { success: false, error: "Valid price is required" },
        { status: 400 }
      );
    }

    if (!sale_starts_at || !sale_ends_at) {
      return NextResponse.json(
        { success: false, error: "Sale start and end dates are required" },
        { status: 400 }
      );
    }

    const saleStart = new Date(sale_starts_at);
    const saleEnd = new Date(sale_ends_at);

    // For new tickets, be more flexible with sale timing
    // Allow sales to continue during the event for last-minute purchases
    // Only prevent obviously invalid scenarios
    if (saleStart >= saleEnd) {
      return NextResponse.json(
        { success: false, error: "Sale end date must be after start date" },
        { status: 400 }
      );
    }

    // Allow sale periods to be flexible - don't enforce strict timing rules
    // Event organizers should have control over their ticket sales strategy

    if (
      quantity_available !== null &&
      quantity_available !== undefined &&
      quantity_available < 0
    ) {
      return NextResponse.json(
        { success: false, error: "Quantity available cannot be negative" },
        { status: 400 }
      );
    }

    if (
      max_per_person !== null &&
      max_per_person !== undefined &&
      max_per_person < 1
    ) {
      return NextResponse.json(
        { success: false, error: "Max per person must be at least 1" },
        { status: 400 }
      );
    }

    // Create ticket type
    // Normalize nullable numeric fields: empty => null, keep 0 as 0
    const normalizedQuantity =
      quantity_available === undefined || quantity_available === ""
        ? null
        : quantity_available;
    const normalizedMaxPerPerson =
      max_per_person === undefined || max_per_person === ""
        ? 10
        : max_per_person;

    const { data: ticketType, error: ticketError } = await supabase
      .from("ticket_types")
      .insert({
        event_id: eventId,
        name: name.trim(),
        description: description?.trim() || null,
        price,
        quantity_available: normalizedQuantity,
        sale_starts_at: saleStart.toISOString(),
        sale_ends_at: saleEnd.toISOString(),
        max_per_person: normalizedMaxPerPerson,
      })
      .select()
      .single();

    if (ticketError) {
      console.error("Error creating ticket type:", ticketError);
      return NextResponse.json(
        { success: false, error: "Failed to create ticket type" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticketType,
    });
  } catch (error) {
    console.error("Error in admin tickets POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
