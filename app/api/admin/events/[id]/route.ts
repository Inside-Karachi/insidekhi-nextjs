import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

// GET /api/admin/events/[id] - Get single event details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;
    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    // Only allow lister, admin, super_admin
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }
    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }
    // Use service_role only for super_admin
    let dbClient = supabase;
    if (profile.role === "super_admin") {
      dbClient = await createServerSupabase({ useServiceRole: true });
    }
    // Get event with details
    const { data: event, error } = await dbClient
      .from("events_with_details")
      .select("*")
      .eq("event_id", eventId)
      .single();
    if (error) {
      console.error("Error fetching event:", error);
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }
    // Get event images
    const { data: images, error: imagesError } = await dbClient
      .from("event_images")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order", { ascending: true });
    if (imagesError) {
      console.error("Error fetching event images:", imagesError);
    }
    return NextResponse.json({
      success: true,
      data: {
        ...event,
        images: images || [],
      },
    });
  } catch (error) {
    console.error("Error in admin event GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/events/[id] - Update event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;
    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    // Only allow lister, admin, super_admin
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }
    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }
    // Use service_role only for super_admin
    let dbClient = supabase;
    if (profile.role === "super_admin") {
      dbClient = await createServerSupabase({ useServiceRole: true });
    }
    // Get existing event data before update for logging
    const { data: existingEvent, error: fetchError } = await dbClient
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (fetchError || !existingEvent) {
      console.error("Error fetching existing event for update:", fetchError);
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }
    const body = await request.json();
    const {
      name,
      description,
      start_time,
      end_time,
      location_name,
      address,
      latitude,
      longitude,
      category_id,
      max_capacity,
      is_featured,
      featured_rank,
      commission_rate,
      is_commission_based,
      status,
      organizer_id,
      require_guest_details,
    } = body;
    // Prepare update data
    const updateData: Database["public"]["Tables"]["events"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) {
      updateData.name = name;
      // Regenerate slug if name changed
      updateData.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    if (description !== undefined) updateData.description = description;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (location_name !== undefined) updateData.location_name = location_name;
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (max_capacity !== undefined) updateData.max_capacity = max_capacity;
    if (is_featured !== undefined) updateData.is_featured = is_featured;
    if (featured_rank !== undefined) updateData.featured_rank = featured_rank;
    if (commission_rate !== undefined)
      updateData.commission_rate = commission_rate;
    if (is_commission_based !== undefined)
      updateData.is_commission_based = is_commission_based;
    if (status !== undefined) updateData.status = status;
    if (organizer_id !== undefined) updateData.organizer_id = organizer_id;
    if (require_guest_details !== undefined)
      updateData.require_guest_details = require_guest_details;
    // Update event
    const { data: event, error } = await dbClient
      .from("events")
      .update(updateData)
      .eq("id", eventId)
      .select()
      .single();
    if (error) {
      console.error("Error updating event:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update event" },
        { status: 500 },
      );
    }
    // Log the admin action
    try {
      const { logEventUpdate } = await import("@/lib/audit");
      await logEventUpdate(
        user.id,
        eventId.toString(),
        existingEvent,
        event,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log event update:", logError);
    }
    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error in admin event PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/events/[id] - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;
    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    // Only allow admin, super_admin, lister to delete
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }
    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }
    // Use service_role only for super_admin
    let dbClient = supabase;
    if (profile.role === "super_admin") {
      dbClient = await createServerSupabase({ useServiceRole: true });
    }
    // Get event data before deletion for logging
    const { data: eventToDelete, error: fetchError } = await dbClient
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (fetchError || !eventToDelete) {
      console.error("Error fetching event for deletion:", fetchError);
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }
    // Delete event (this will cascade to related records)
    const { error } = await dbClient.from("events").delete().eq("id", eventId);
    if (error) {
      console.error("Error deleting event:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete event" },
        { status: 500 },
      );
    }

    // Clean up event images from storage
    try {
      console.log(`[EventDelete] Cleaning up images for event ${eventId}`);

      // List all files in the event's folder
      const { data: files, error: listError } = await supabase.storage
        .from("event-images")
        .list(`${eventId}/`);

      if (listError) {
        console.error("Error listing event images:", listError);
      } else if (files && files.length > 0) {
        // Delete all image files
        const filePaths = files.map((file) => `${eventId}/${file.name}`);
        const { error: deleteError } = await supabase.storage
          .from("event-images")
          .remove(filePaths);

        if (deleteError) {
          console.error("Error deleting event images:", deleteError);
        } else {
          console.log(
            `[EventDelete] Successfully deleted ${filePaths.length} image files for event ${eventId}`,
          );
        }
      }
    } catch (cleanupError) {
      console.error("Error during image cleanup:", cleanupError);
      // Don't fail the deletion if image cleanup fails
    }
    // Log the admin action
    try {
      const { logEventDeletion } = await import("@/lib/audit");
      await logEventDeletion(
        user.id,
        eventId.toString(),
        eventToDelete,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log event deletion:", logError);
    }
    return NextResponse.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error in admin event DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
