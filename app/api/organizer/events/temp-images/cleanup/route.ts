import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["organizer", "lister", "admin", "super_admin"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Use service role for storage operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // List files in temp folder
    const tempPath = `temp/${tempSessionId}`;
    const { data: tempFiles, error: listError } = await adminSupabase.storage
      .from("event-images")
      .list(tempPath);

    if (listError) {
      console.error("Error listing temp files:", listError);
      return NextResponse.json(
        { error: "Failed to list temp files" },
        { status: 500 }
      );
    }

    if (!tempFiles || tempFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No temp images to cleanup",
        deletedCount: 0,
      });
    }

    // Delete all temp files
    const filesToDelete = tempFiles.map((file) => `${tempPath}/${file.name}`);
    const { error: deleteError } = await adminSupabase.storage
      .from("event-images")
      .remove(filesToDelete);

    if (deleteError) {
      console.error("Error deleting temp files:", deleteError);
      return NextResponse.json(
        { error: "Failed to cleanup temp files" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${tempFiles.length} temp images`,
      deletedCount: tempFiles.length,
    });
  } catch (error) {
    console.error("Cleanup temp images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
