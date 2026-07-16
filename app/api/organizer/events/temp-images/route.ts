import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { uploadFile } from "@/lib/storage/spaces";

const ALLOWED_ROLES = ["organizer", "lister", "admin", "super_admin"];

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
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is organizer, lister, or admin
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { error: "Only organizers can upload event images" },
        { status: 403 }
      );
    }

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
    const path = `event-images/temp/${tempSessionId}/${filename}`;

    // Upload to DigitalOcean Spaces
    const arrayBuffer = await file.arrayBuffer();
    let publicUrl: string;
    try {
      const uploaded = await uploadFile(path, Buffer.from(arrayBuffer), {
        contentType: file.type,
      });
      publicUrl = uploaded.publicUrl;
    } catch (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Return image info (simulate EventImage for consistency with gallery component)
    const newImage = {
      id: Date.now(), // temp id, not persisted to DB yet
      event_id: null,
      url: publicUrl,
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
