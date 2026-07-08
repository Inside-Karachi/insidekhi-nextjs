import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Force dynamic to ensure fresh ticket data
export const dynamic = "force-dynamic";

// GET /api/organizer/events/[eventId]/tickets - Get tickets for an event owned by the organizer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const supabase = await createServerSupabase();

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

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify user owns this event or is admin/lister
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const eventIdNum = parseInt(eventId, 10);

    // Check event ownership
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", eventIdNum)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === user.id;
    const isAdmin = ["admin", "super_admin", "lister"].includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Fetch ticket types
    const { data: ticketTypes, error: ticketsError } = await adminSupabase
      .from("ticket_types")
      .select("*")
      .eq("event_id", eventIdNum)
      .order("id", { ascending: true });

    if (ticketsError) {
      console.error("Error fetching tickets:", ticketsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch tickets" },
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
    console.error("Error in organizer tickets GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizer/events/[eventId]/tickets - Create a new ticket type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const supabase = await createServerSupabase();

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

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const eventIdNum = parseInt(eventId, 10);

    // Verify ownership
    const { data: event } = await adminSupabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", eventIdNum)
      .single();

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === user.id;
    const isAdmin = ["admin", "super_admin", "lister"].includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Validate required fields
    if (
      !body.name ||
      body.price === undefined ||
      body.quantity_available === undefined
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create ticket type
    const { data: ticketType, error: createError } = await adminSupabase
      .from("ticket_types")
      .insert({
        event_id: eventIdNum,
        name: body.name,
        description: body.description || null,
        price: parseFloat(body.price),
        quantity_available: parseInt(body.quantity_available, 10),
        sale_starts_at: body.sale_starts_at || null,
        sale_ends_at: body.sale_ends_at || null,
        max_per_person: body.max_per_person
          ? parseInt(body.max_per_person, 10)
          : 10,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating ticket:", createError);
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
    console.error("Error in organizer tickets POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizer/events/[eventId]/tickets - Update a ticket type
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");
    const body = await request.json();

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
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

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const eventIdNum = parseInt(eventId, 10);
    const ticketIdNum = parseInt(ticketId, 10);

    // Verify ownership
    const { data: event } = await adminSupabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", eventIdNum)
      .single();

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === user.id;
    const isAdmin = ["admin", "super_admin", "lister"].includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined)
      updateData.description = body.description || null;
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.quantity_available !== undefined) {
      updateData.quantity_available = parseInt(body.quantity_available, 10);
    }
    if (body.sale_starts_at !== undefined)
      updateData.sale_starts_at = body.sale_starts_at || null;
    if (body.sale_ends_at !== undefined)
      updateData.sale_ends_at = body.sale_ends_at || null;
    if (body.max_per_person !== undefined) {
      updateData.max_per_person = parseInt(body.max_per_person, 10);
    }

    const { data: ticketType, error: updateError } = await adminSupabase
      .from("ticket_types")
      .update(updateData)
      .eq("id", ticketIdNum)
      .eq("event_id", eventIdNum)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating ticket:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update ticket type" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticketType,
    });
  } catch (error) {
    console.error("Error in organizer tickets PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizer/events/[eventId]/tickets - Delete a ticket type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
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

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const eventIdNum = parseInt(eventId, 10);
    const ticketIdNum = parseInt(ticketId, 10);

    // Verify ownership
    const { data: event } = await adminSupabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", eventIdNum)
      .single();

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === user.id;
    const isAdmin = ["admin", "super_admin", "lister"].includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if ticket has any bookings
    const { count: bookingCount } = await adminSupabase
      .from("booking_items")
      .select("*", { count: "exact", head: true })
      .eq("ticket_type_id", ticketIdNum);

    if (bookingCount && bookingCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete ticket type with existing bookings",
        },
        { status: 400 }
      );
    }

    const { error: deleteError } = await adminSupabase
      .from("ticket_types")
      .delete()
      .eq("id", ticketIdNum)
      .eq("event_id", eventIdNum);

    if (deleteError) {
      console.error("Error deleting ticket:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete ticket type" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ticket type deleted successfully",
    });
  } catch (error) {
    console.error("Error in organizer tickets DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
