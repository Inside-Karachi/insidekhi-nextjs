import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { copyFile, deleteFile, getPublicUrl, listFiles } from "@/lib/storage/spaces";

export async function POST(request: NextRequest) {
  let parsedBody = null;
  try {
    const rawBody = await request.text();
    parsedBody = JSON.parse(rawBody);
  } catch (_err) {
    return NextResponse.json(
      { error: "Malformed request body" },
      { status: 400 }
    );
  }
  const { tempSessionId, eventId } = parsedBody || {};
  if (!tempSessionId || !eventId) {
    return NextResponse.json(
      { error: "Missing tempSessionId or eventId" },
      { status: 400 }
    );
  }

  try {
    // Auth check (lister/admin/super_admin)
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only allow lister, admin, super_admin
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // List all files in temp folder
    const tempFolder = `event-images/temp/${tempSessionId}/`;
    let tempKeys: string[];
    try {
      tempKeys = await listFiles(tempFolder);
    } catch (listError) {
      return NextResponse.json(
        { error: (listError as Error).message },
        { status: 500 }
      );
    }
    if (!tempKeys || tempKeys.length === 0) {
      return NextResponse.json({ success: true, moved: 0 });
    }

    // Move each file to event folder and insert DB record
    let displayOrder = 1;
    const movedFiles = [];
    for (const fromPath of tempKeys) {
      const fileName = fromPath.split("/").pop() || fromPath;
      const toPath = `event-images/${eventId}/${fileName}`;

      // Copy file
      try {
        await copyFile(fromPath, toPath);
      } catch (copyError) {
        return NextResponse.json(
          { error: (copyError as Error).message },
          { status: 500 }
        );
      }

      // Remove from temp
      try {
        await deleteFile(fromPath);
      } catch (removeError) {
        return NextResponse.json(
          { error: (removeError as Error).message },
          { status: 500 }
        );
      }

      const publicUrl = getPublicUrl(toPath);

      // Insert into event_images
      try {
        await query(
          `INSERT INTO event_images (event_id, url, alt_text, display_order, is_primary)
           VALUES ($1, $2, $3, $4, $5)`,
          [Number(eventId), publicUrl, fileName, displayOrder, displayOrder === 1]
        );
      } catch (dbError) {
        return NextResponse.json(
          { error: (dbError as Error).message },
          { status: 500 }
        );
      }
      movedFiles.push(toPath);
      displayOrder++;
    }

    return NextResponse.json({ success: true, moved: movedFiles.length });
  } catch (_err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
