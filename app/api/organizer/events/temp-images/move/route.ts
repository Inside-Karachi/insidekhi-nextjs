import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { copyFile, deleteFile, getPublicUrl, listFiles } from "@/lib/storage/spaces";

const ALLOWED_ROLES = ["organizer", "lister", "admin", "super_admin"];

const EVENT_IMAGE_COLUMNS =
  "id, event_id, url, alt_text, is_primary, display_order, " +
  "to_json(created_at) #>> '{}' AS created_at";

function toNumericEventImage(row: Record<string, unknown>) {
  return {
    ...row,
    id: Number(row.id),
    event_id: Number(row.event_id),
  };
}

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
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const eventIdNum = Number(eventId);

    // For organizers, verify they own the event
    if (profile.role === "organizer") {
      const { rows: eventRows } = await query(
        `SELECT organizer_id FROM events WHERE id = $1`,
        [eventIdNum]
      );
      const event = eventRows[0];

      if (!event || event.organizer_id !== session.userId) {
        return NextResponse.json(
          { error: "You don't own this event" },
          { status: 403 }
        );
      }
    }

    // List files in temp folder
    const tempPath = `event-images/temp/${tempSessionId}/`;
    let tempKeys: string[];
    try {
      tempKeys = await listFiles(tempPath);
    } catch (error) {
      console.error("Error listing temp files:", error);
      return NextResponse.json(
        { error: "Failed to list temp files" },
        { status: 500 }
      );
    }

    if (!tempKeys || tempKeys.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No temp images to move",
        movedCount: 0,
      });
    }

    // Get current max display_order
    const { rows: maxOrderRows } = await query(
      `SELECT MAX(display_order) AS max_order FROM event_images WHERE event_id = $1`,
      [eventIdNum]
    );
    let currentOrder = maxOrderRows[0]?.max_order || 0;
    const movedImages = [];

    // Move each file
    for (const oldPath of tempKeys) {
      const fileName = oldPath.split("/").pop() || oldPath;
      const newPath = `event-images/event-${eventIdNum}-${Date.now()}-${fileName}`;

      // Copy to permanent location
      try {
        await copyFile(oldPath, newPath);
      } catch (copyError) {
        console.error(`Error copying file ${fileName}:`, copyError);
        continue;
      }

      const publicUrl = getPublicUrl(newPath);
      currentOrder++;

      // Insert into database
      let imageRecord;
      try {
        const { rows } = await query(
          `INSERT INTO event_images (event_id, url, alt_text, display_order, is_primary)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING ${EVENT_IMAGE_COLUMNS}`,
          [eventIdNum, publicUrl, fileName, currentOrder, currentOrder === 1]
        );
        imageRecord = toNumericEventImage(rows[0]);
      } catch (insertError) {
        console.error(`Error inserting image record:`, insertError);
        // Try to clean up the copied file
        try {
          await deleteFile(newPath);
        } catch {
          // best-effort cleanup
        }
        continue;
      }

      movedImages.push(imageRecord);

      // Delete from temp
      try {
        await deleteFile(oldPath);
      } catch {
        // best-effort cleanup
      }
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
