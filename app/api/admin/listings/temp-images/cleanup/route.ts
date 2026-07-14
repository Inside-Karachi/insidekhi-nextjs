import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listFiles, deleteFile } from "@/lib/storage/spaces";

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

    // Auth check
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // List all files in temp folder
    const tempFolder = `temp/${tempSessionId}`;
    let paths;
    try {
      paths = await listFiles(tempFolder, "listing-images");
    } catch (listError) {
      return NextResponse.json(
        { error: listError instanceof Error ? listError.message : "Unknown error" },
        { status: 500 },
      );
    }
    if (!paths || paths.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }
    // Remove all files
    try {
      await Promise.all(paths.map((path) => deleteFile(path, "listing-images")));
    } catch (removeError) {
      return NextResponse.json(
        { error: removeError instanceof Error ? removeError.message : "Unknown error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, deleted: paths.length });
  } catch (_err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
