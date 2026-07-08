import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

// POST: Upload image to temp folder
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

    // Auth check (lister/admin/super_admin)
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const filename = `${uuidv4()}.${ext}`;
    const path = `temp/${tempSessionId}/${filename}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("listing-images")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Return image info (simulate ListingImage)
    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${path}`;
    const newImage = {
      id: Date.now(), // temp id, not persisted
      listing_id: null,
      url: imageUrl,
      alt_text: null,
      is_primary: false,
      display_order: 0,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, data: newImage });
  } catch (_err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete image from temp folder
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tempSessionId = searchParams.get("tempSessionId");
    const imageId = searchParams.get("imageId");

    if (!tempSessionId || !imageId) {
      return NextResponse.json(
        { error: "Missing tempSessionId or imageId" },
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

    // Find and delete file in temp folder
    const folder = `temp/${tempSessionId}`;
    // List files in temp folder
    const { data: files, error: listError } = await supabase.storage
      .from("listing-images")
      .list(folder);
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    // Find file by id (filename contains imageId)
    const fileToDelete = files?.find((f) => f.name.startsWith(imageId));
    if (!fileToDelete) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const { error: deleteError } = await supabase.storage
      .from("listing-images")
      .remove([`${folder}/${fileToDelete.name}`]);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (_err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
