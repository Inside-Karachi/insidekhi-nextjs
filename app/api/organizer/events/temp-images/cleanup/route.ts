import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteFile, listFiles } from "@/lib/storage/spaces";

const ALLOWED_ROLES = ["organizer", "lister", "admin", "super_admin"];

// POST: Cleanup temp images (called when modal is closed without saving)
export async function POST(request: NextRequest) {
  try {
    const { tempSessionId } = await request.json();

    if (!tempSessionId) {
      return NextResponse.json(
        { error: "Missing tempSessionId" },
        { status: 400 }
      );
    }

    // Auth check
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // List files in temp folder
    const tempPath = `event-images/temp/${tempSessionId}/`;
    let tempKeys: string[];
    try {
      tempKeys = await listFiles(tempPath);
    } catch (error) {
      console.error("Error listing temp files:", error);
      return NextResponse.json(
        { error: "Failed to cleanup temp files" },
        { status: 500 }
      );
    }

    if (!tempKeys || tempKeys.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No temp images to cleanup",
        deletedCount: 0,
      });
    }

    // Delete all temp files
    try {
      await Promise.all(tempKeys.map((key) => deleteFile(key)));
    } catch (deleteError) {
      console.error("Error deleting temp files:", deleteError);
      return NextResponse.json(
        { error: "Failed to cleanup temp files" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${tempKeys.length} temp images`,
      deletedCount: tempKeys.length,
    });
  } catch (error) {
    console.error("Cleanup temp images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
