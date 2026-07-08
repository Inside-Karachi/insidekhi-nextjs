import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// PUT /api/admin/events/[id]/tickets/[ticketId] - Update ticket type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id, ticketId } = await params;

    // Check admin authentication
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

    // Use service role client for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get user profile with role
    const { data: profile, error: profileError } = await adminSupabase
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

    // Check admin or lister role
    if (
      profile.role !== "admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "lister"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const eventId = parseInt(id);
    const ticketTypeId = parseInt(ticketId);

    if (isNaN(eventId) || isNaN(ticketTypeId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event or ticket ID" },
        { status: 400 }
      );
    }

    // Verify ticket type exists and belongs to the event
    const { data: existingTicket, error: ticketCheckError } =
      await adminSupabase
        .from("ticket_types")
        .select("id, event_id")
        .eq("id", ticketTypeId)
        .eq("event_id", eventId)
        .single();

    if (ticketCheckError || !existingTicket) {
      return NextResponse.json(
        { success: false, error: "Ticket type not found" },
        { status: 404 }
      );
    }

    // Get event details for validation
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, start_time, end_time")
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

    // Get current ticket data for comparison
    const { error: currentTicketError } = await adminSupabase
      .from("ticket_types")
      .select("sale_starts_at, sale_ends_at")
      .eq("id", ticketTypeId)
      .single();

    if (currentTicketError) {
      console.error("Error fetching current ticket:", currentTicketError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch current ticket data" },
        { status: 500 }
      );
    }

    // Validation - More flexible for updates
    if (name !== undefined && !name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Ticket name cannot be empty" },
        { status: 400 }
      );
    }

    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return NextResponse.json(
        { success: false, error: "Valid price is required" },
        { status: 400 }
      );
    }

    let saleStart: Date | undefined;
    let saleEnd: Date | undefined;

    if (sale_starts_at) {
      saleStart = new Date(sale_starts_at);
    }

    if (sale_ends_at) {
      saleEnd = new Date(sale_ends_at);
    }

    // Only validate date logic if dates are being changed
    if (
      (saleStart || saleEnd) &&
      saleStart &&
      saleEnd &&
      saleStart >= saleEnd
    ) {
      return NextResponse.json(
        { success: false, error: "Sale end date must be after start date" },
        { status: 400 }
      );
    }

    // For updates, be more lenient with sale end date validation
    // Only prevent obviously invalid scenarios (like sale ending before sale starts)
    // Allow sale periods to extend beyond event time for flexibility
    if (saleStart && saleEnd && saleStart >= saleEnd) {
      return NextResponse.json(
        { success: false, error: "Sale end date must be after start date" },
        { status: 400 }
      );
    }

    if (
      quantity_available !== undefined &&
      quantity_available !== null &&
      quantity_available < 0
    ) {
      return NextResponse.json(
        { success: false, error: "Quantity available cannot be negative" },
        { status: 400 }
      );
    }

    if (
      max_per_person !== undefined &&
      max_per_person !== null &&
      max_per_person < 1
    ) {
      return NextResponse.json(
        { success: false, error: "Max per person must be at least 1" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Record<string, string | number | null> = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (price !== undefined) updateData.price = price;
    if (quantity_available !== undefined) {
      // allow explicit null to mean unlimited; 0 stays as 0; positive numbers allowed
      updateData.quantity_available = quantity_available;
    }
    if (sale_starts_at !== undefined)
      updateData.sale_starts_at = saleStart ? saleStart.toISOString() : null;
    if (sale_ends_at !== undefined)
      updateData.sale_ends_at = saleEnd ? saleEnd.toISOString() : null;
    if (max_per_person !== undefined)
      updateData.max_per_person = max_per_person;

    // Update ticket type
    const { data: ticketType, error: updateError } = await adminSupabase
      .from("ticket_types")
      .update(updateData)
      .eq("id", ticketTypeId)
      .eq("event_id", eventId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating ticket type:", updateError);
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
    console.error("Error in admin ticket PUT:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/events/[id]/tickets/[ticketId] - Delete ticket type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id, ticketId } = await params;

    // Check admin authentication
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

    // Use service role client for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get user profile with role
    const { data: profile, error: profileError } = await adminSupabase
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

    // Check admin or lister role
    if (
      profile.role !== "admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "lister"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const eventId = parseInt(id);
    const ticketTypeId = parseInt(ticketId);

    if (isNaN(eventId) || isNaN(ticketTypeId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event or ticket ID" },
        { status: 400 }
      );
    }

    // Check if ticket type has any bookings before deleting
    console.log(`Checking bookings for ticket type ${ticketTypeId}`);
    const { data: bookings, error: bookingsError } = await adminSupabase
      .from("booking_items")
      .select("booking_id")
      .eq("ticket_type_id", ticketTypeId)
      .limit(1);

    if (bookingsError) {
      console.error("Error checking bookings:", bookingsError);
      return NextResponse.json(
        { success: false, error: "Failed to check existing bookings" },
        { status: 500 }
      );
    }

    if (bookings && bookings.length > 0) {
      console.log(
        `Found ${bookings.length} booking(s) for ticket type ${ticketTypeId}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete ticket type with existing bookings",
        },
        { status: 400 }
      );
    }

    console.log(
      `No bookings found for ticket type ${ticketTypeId}, proceeding with deletion`
    );

    // Delete ticket type
    const { error: deleteError } = await adminSupabase
      .from("ticket_types")
      .delete()
      .eq("id", ticketTypeId)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Error deleting ticket type:", deleteError);
      console.error("Delete error details:", {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
      });

      // Provide more specific error messages based on error type
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot delete ticket type due to database constraints",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: "Failed to delete ticket type" },
        { status: 500 }
      );
    }

    console.log(`Successfully deleted ticket type ${ticketTypeId}`);
    return NextResponse.json({
      success: true,
      message: "Ticket type deleted successfully",
    });
  } catch (error) {
    console.error("Error in admin ticket DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
