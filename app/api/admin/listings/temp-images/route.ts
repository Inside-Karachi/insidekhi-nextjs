import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadFile, deleteFile, listFiles } from "@/lib/storage/spaces";

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
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const filename = `${uuidv4()}.${ext}`;
    const path = `temp/${tempSessionId}/${filename}`;

    // Upload to DO Spaces Storage (uses default bucket listing-images equivalent folder structure)
    const arrayBuffer = await file.arrayBuffer();
    const uploadResult = await uploadFile(path, Buffer.from(arrayBuffer), {
      contentType: file.type,
      isPublic: true,
      bucket: "listing-images"
    });

    // Return image info (simulate ListingImage)
    const newImage = {
      id: Date.now(), // temp id, not persisted
      listing_id: null,
      url: uploadResult.publicUrl,
      alt_text: null,
      is_primary: false,
      display_order: 0,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, data: newImage });
  } catch (_err) {
    console.error("Listing temp image upload failed:", _err);
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
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find and delete file in temp folder
    const folder = `temp/${tempSessionId}`;
    
    // List files in temp folder on Spaces
    const files = await listFiles(folder, "listing-images");
    
    // Find file by id (filename contains imageId)
    const fileToDelete = files?.find((f) => {
      const parts = f.split("/");
      const name = parts[parts.length - 1];
      return name.startsWith(imageId);
    });

    if (!fileToDelete) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await deleteFile(fileToDelete, "listing-images");

    return NextResponse.json({ success: true });
  } catch (_err) {
    console.error("Listing temp image delete failed:", _err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

