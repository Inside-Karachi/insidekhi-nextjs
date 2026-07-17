import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteFile, getKeyFromPublicUrl } from "@/lib/storage/spaces";

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

// PATCH /api/admin/events/[id]/images/[imageId] - Update image properties
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { id, imageId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile with role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile) {
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
      await query(
        `UPDATE event_images SET is_primary = false WHERE event_id = $1 AND id != $2`,
        [eventId, imageIdNum]
      );
    }

    // Update the image
    const setClauses: string[] = [];
    const updateParams: unknown[] = [];

    const pushField = (column: string, value: unknown) => {
      updateParams.push(value);
      setClauses.push(`${column} = $${updateParams.length}`);
    };

    if (is_primary !== undefined) pushField("is_primary", is_primary);
    if (alt_text !== undefined) pushField("alt_text", alt_text);
    if (display_order !== undefined) pushField("display_order", display_order);

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to update image" },
        { status: 500 }
      );
    }

    updateParams.push(imageIdNum, eventId);
    const idIdx = updateParams.length - 1;
    const eventIdIdx = updateParams.length;

    let image;
    try {
      const { rows } = await query(
        `UPDATE event_images SET ${setClauses.join(", ")}
         WHERE id = $${idIdx} AND event_id = $${eventIdIdx}
         RETURNING ${EVENT_IMAGE_COLUMNS}`,
        updateParams
      );
      if (!rows[0]) {
        return NextResponse.json(
          { success: false, error: "Failed to update image" },
          { status: 500 }
        );
      }
      image = toNumericEventImage(rows[0]);
    } catch (error) {
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
    const { id, imageId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile with role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile) {
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
    const { rows: imageRows } = await query(
      `SELECT * FROM event_images WHERE id = $1 AND event_id = $2`,
      [imageIdNum, eventId]
    );
    const image = imageRows[0];

    if (!image) {
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 }
      );
    }

    // Delete from database first
    try {
      await query(
        `DELETE FROM event_images WHERE id = $1 AND event_id = $2`,
        [imageIdNum, eventId]
      );
    } catch (deleteError) {
      console.error("Error deleting image from database:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete image" },
        { status: 500 }
      );
    }

    // Try to delete from storage (don't fail if this doesn't work)
    try {
      const key = getKeyFromPublicUrl(image.url);
      if (key) {
        await deleteFile(key);
      }
    } catch (storageError) {
      console.warn("Failed to delete image from storage:", storageError);
      // Don't return error - database deletion was successful
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
