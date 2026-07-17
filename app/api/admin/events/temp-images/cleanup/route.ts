import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteFile, listFiles } from "@/lib/storage/spaces";

// POST: Delete all images in a temp session folder
export async function POST(request: NextRequest) {
  try {
    const { tempSessionId } = await request.json();
    if (!tempSessionId) {
      return NextResponse.json(
        { error: "Missing tempSessionId" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Remove all files
    try {
      await Promise.all(tempKeys.map((key) => deleteFile(key)));
    } catch (removeError) {
      return NextResponse.json(
        { error: (removeError as Error).message },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, deleted: tempKeys.length });
  } catch (_err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
