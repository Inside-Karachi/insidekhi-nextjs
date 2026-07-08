import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

// POST: Upload image to temp folder (for organizers creating new events)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tempSessionId = formData.get("tempSessionId") as string | null;

    if (!file || !tempSessionId) {
      return NextResponse.json(
        { error: "Missing file or tempSessionId" },
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

    // Verify user is organizer, lister, or admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["organizer", "lister", "admin", "super_admin"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Only organizers can upload event images" },
        { status: 403 }
      );
    }

    // Use service role for storage operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum 5MB allowed" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const filename = `${uuidv4()}.${ext}`;
    const path = `temp/${tempSessionId}/${filename}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await adminSupabase.storage
      .from("event-images")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Return image info (simulate EventImage for consistency with gallery component)
    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${path}`;
    const newImage = {
      id: Date.now(), // temp id, not persisted to DB yet
      event_id: null,
      url: imageUrl,
      alt_text: file.name,
      is_primary: false,
      display_order: 0,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: newImage });
  } catch (error) {
    console.error("Temp image upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
