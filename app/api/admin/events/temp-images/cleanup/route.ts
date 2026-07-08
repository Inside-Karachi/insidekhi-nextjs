import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only allow lister, admin, super_admin
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Use service_role only for super_admin
    let storageClient = supabase;
    if (profile.role === "super_admin") {
      storageClient = await createServerSupabase({ useServiceRole: true });
    }

    // List all files in temp folder
    const tempFolder = `temp/${tempSessionId}`;
    const { data: files, error: listError } = await storageClient.storage
      .from("event-images")
      .list(tempFolder);
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }
    // Remove all files
    const paths = files.map((f: { name: string }) => `${tempFolder}/${f.name}`);
    const { error: removeError } = await storageClient.storage
      .from("event-images")
      .remove(paths);
    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: paths.length });
  } catch (_err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
