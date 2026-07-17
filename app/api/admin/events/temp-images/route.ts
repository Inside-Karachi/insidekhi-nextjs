import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadFile } from "@/lib/storage/spaces";
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
    const path = `event-images/temp/${tempSessionId}/${filename}`;

    // Upload to DO Spaces Storage (using custom spaces client)
    const arrayBuffer = await file.arrayBuffer();
    const uploadResult = await uploadFile(path, Buffer.from(arrayBuffer), {
      contentType: file.type,
      isPublic: true,
    });

    // Return image info (simulate EventImage)
    const newImage = {
      id: Date.now(), // temp id, not persisted
      event_id: null,
      url: uploadResult.publicUrl,
      alt_text: null,
      is_primary: false,
      display_order: 0,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, data: newImage });
  } catch (_err) {
    console.error("Event temp image upload failed:", _err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

