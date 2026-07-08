import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

// PATCH /api/admin/events/[id]/images/[imageId] - Update image properties
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id, imageId } = await params;

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
    const imageIdNum = parseInt(imageId);

    if (isNaN(eventId) || isNaN(imageIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { is_primary, alt_text, display_order } = body;

    // If setting as primary, unset other primary images for this event
    if (is_primary === true) {
      await adminSupabase
        .from("event_images")
        .update({ is_primary: false })
        .eq("event_id", eventId)
        .neq("id", imageIdNum);
    }

    // Update the image
    const updateData: Database["public"]["Tables"]["event_images"]["Update"] =
      {};
    if (is_primary !== undefined) updateData.is_primary = is_primary;
    if (alt_text !== undefined) updateData.alt_text = alt_text;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data: image, error } = await adminSupabase
      .from("event_images")
      .update(updateData)
      .eq("id", imageIdNum)
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) {
      console.error("Error updating image:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update image" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: image,
    });
  } catch (error) {
    console.error("Error in admin event image PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/events/[id]/images/[imageId] - Delete image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id, imageId } = await params;

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
    const imageIdNum = parseInt(imageId);

    if (isNaN(eventId) || isNaN(imageIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    // Get image data first to get the file path for cleanup
    const { data: image, error: fetchError } = await adminSupabase
      .from("event_images")
      .select("*")
      .eq("id", imageIdNum)
      .eq("event_id", eventId)
      .single();

    if (fetchError || !image) {
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 }
      );
    }

    // Delete from database first
    const { error: deleteError } = await adminSupabase
      .from("event_images")
      .delete()
      .eq("id", imageIdNum)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Error deleting image from database:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete image" },
        { status: 500 }
      );
    }

    // Extract filename from URL for cleanup
    const urlParts = image.url.split("/");
    const fileName = urlParts[urlParts.length - 1];

    if (fileName) {
      // Try to delete from storage (don't fail if this doesn't work)
      const { error: storageError } = await adminSupabase.storage
        .from("event-images")
        .remove([fileName]);

      if (storageError) {
        console.warn("Failed to delete image from storage:", storageError);
        // Don't return error - database deletion was successful
      }
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error in admin event image DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
