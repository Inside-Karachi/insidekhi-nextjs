import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/organizer/events/[eventId]/images - Get images for an event owned by the organizer
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

    // Verify user owns this event or is admin/lister
    const { data: profile } = await supabase
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

    // Check event ownership
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", parseInt(eventId, 10))
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    // Only allow organizer who owns the event or admin/lister
    const isOwner = event.organizer_id === user.id;
    const isAdmin = ["admin", "super_admin", "lister"].includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Fetch images using correct column names
    const { data: images, error: imagesError } = await supabase
      .from("event_images")
      .select(
        "id, event_id, url, alt_text, is_primary, display_order, created_at"
      )
      .eq("event_id", parseInt(eventId, 10))
      .order("display_order", { ascending: true });

    if (imagesError) {
      console.error("Error fetching event images:", imagesError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch images" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      images: images || [],
    });
  } catch (error) {
    console.error("Error in organizer event images API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizer/events/[eventId]/images - Upload new image for an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { eventId } = await params;

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

    // Use service role client for storage operations
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

    const eventIdNum = parseInt(eventId);
    if (isNaN(eventIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Verify event exists and user owns it (or is admin/lister)
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

    // Check access: owner, organizer role, or admin/lister
    const isOwner = event.organizer_id === user.id;
    const isAdmin = ["admin", "super_admin", "lister"].includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to upload images to this event",
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Only JPEG, PNG, and WebP are allowed",
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File size too large. Maximum 5MB allowed" },
        { status: 400 }
      );
    }

    // Check current image count
    const { count: imageCount, error: countError } = await adminSupabase
      .from("event_images")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventIdNum);

    if (countError) {
      console.error("Error counting images:", countError);
      return NextResponse.json(
        { success: false, error: "Failed to check image count" },
        { status: 500 }
      );
    }

    if ((imageCount || 0) >= 8) {
      return NextResponse.json(
        { success: false, error: "Maximum 8 images allowed per event" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `event-${eventIdNum}-${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from("event-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading to storage:", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = adminSupabase.storage.from("event-images").getPublicUrl(fileName);

    // Get next display order
    const { data: maxOrder } = await adminSupabase
      .from("event_images")
      .select("display_order")
      .eq("event_id", eventIdNum)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    // Save to database
    const { data: imageData, error: dbError } = await adminSupabase
      .from("event_images")
      .insert({
        event_id: eventIdNum,
        url: publicUrl,
        alt_text: file.name,
        display_order: nextOrder,
        is_primary: nextOrder === 1,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving image to database:", dbError);
      // Clean up uploaded file
      await adminSupabase.storage.from("event-images").remove([fileName]);
      return NextResponse.json(
        { success: false, error: "Failed to save image data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: imageData,
    });
  } catch (error) {
    console.error("Error in organizer event images POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizer/events/[eventId]/images - Set primary image
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");
    const body = await request.json();

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: "Image ID is required" },
        { status: 400 }
      );
    }

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

    const eventIdNum = parseInt(eventId);
    const imageIdNum = parseInt(imageId);

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

    // If setting as primary, first reset all other images
    if (body.is_primary === true) {
      await adminSupabase
        .from("event_images")
        .update({ is_primary: false })
        .eq("event_id", eventIdNum);
    }

    // Update the target image
    const { data: updatedImage, error: updateError } = await adminSupabase
      .from("event_images")
      .update({ is_primary: body.is_primary })
      .eq("id", imageIdNum)
      .eq("event_id", eventIdNum)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating image:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update image" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedImage,
    });
  } catch (error) {
    console.error("Error in organizer event images PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizer/events/[eventId]/images - Delete an image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: "Image ID is required" },
        { status: 400 }
      );
    }

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

    const eventIdNum = parseInt(eventId);
    const imageIdNum = parseInt(imageId);

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

    // Get image URL for storage cleanup
    const { data: image } = await adminSupabase
      .from("event_images")
      .select("url")
      .eq("id", imageIdNum)
      .eq("event_id", eventIdNum)
      .single();

    if (!image) {
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 }
      );
    }

    // Delete from database
    const { error: deleteError } = await adminSupabase
      .from("event_images")
      .delete()
      .eq("id", imageIdNum);

    if (deleteError) {
      console.error("Error deleting image:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete image" },
        { status: 500 }
      );
    }

    // Try to delete from storage
    try {
      const urlParts = image.url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      await adminSupabase.storage.from("event-images").remove([fileName]);
    } catch (storageError) {
      console.error("Error deleting from storage:", storageError);
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error in organizer event images DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
