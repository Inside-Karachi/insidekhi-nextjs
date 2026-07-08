import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST: Move temp images to permanent storage after event creation
export async function POST(request: NextRequest) {
  try {
    const { tempSessionId, eventId } = await request.json();

    if (!tempSessionId || !eventId) {
      return NextResponse.json(
        { error: "Missing tempSessionId or eventId" },
        { status: 400 }
      );
    }

    // Auth check
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role for operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify user is organizer, lister, or admin
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["organizer", "lister", "admin", "super_admin"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // For organizers, verify they own the event
    if (profile.role === "organizer") {
      const { data: event } = await adminSupabase
        .from("events")
        .select("organizer_id")
        .eq("id", eventId)
        .single();

      if (!event || event.organizer_id !== user.id) {
        return NextResponse.json(
          { error: "You don't own this event" },
          { status: 403 }
        );
      }
    }

    // List files in temp folder
    const tempPath = `temp/${tempSessionId}`;
    const { data: tempFiles, error: listError } = await adminSupabase.storage
      .from("event-images")
      .list(tempPath);

    if (listError) {
      console.error("Error listing temp files:", listError);
      return NextResponse.json(
        { error: "Failed to list temp files" },
        { status: 500 }
      );
    }

    if (!tempFiles || tempFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No temp images to move",
        movedCount: 0,
      });
    }

    // Get current max display_order
    const { data: maxOrderResult } = await adminSupabase
      .from("event_images")
      .select("display_order")
      .eq("event_id", eventId)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    let currentOrder = maxOrderResult?.display_order || 0;
    const movedImages = [];

    // Move each file
    for (const file of tempFiles) {
      const oldPath = `${tempPath}/${file.name}`;
      const newFileName = `event-${eventId}-${Date.now()}-${file.name}`;

      // Copy to permanent location
      const { error: copyError } = await adminSupabase.storage
        .from("event-images")
        .copy(oldPath, newFileName);

      if (copyError) {
        console.error(`Error copying file ${file.name}:`, copyError);
        continue;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = adminSupabase.storage.from("event-images").getPublicUrl(newFileName);

      currentOrder++;

      // Insert into database
      const { data: imageRecord, error: insertError } = await adminSupabase
        .from("event_images")
        .insert({
          event_id: eventId,
          url: publicUrl,
          alt_text: file.name,
          display_order: currentOrder,
          is_primary: currentOrder === 1,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Error inserting image record:`, insertError);
        // Try to clean up the copied file
        await adminSupabase.storage.from("event-images").remove([newFileName]);
        continue;
      }

      movedImages.push(imageRecord);

      // Delete from temp
      await adminSupabase.storage.from("event-images").remove([oldPath]);
    }

    return NextResponse.json({
      success: true,
      message: `Moved ${movedImages.length} images`,
      movedCount: movedImages.length,
      images: movedImages,
    });
  } catch (error) {
    console.error("Move temp images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
