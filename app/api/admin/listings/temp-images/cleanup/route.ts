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

    // Auth check
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // List all files in temp folder
    const tempFolder = `temp/${tempSessionId}`;
    const { data: files, error: listError } = await supabase.storage
      .from("listing-images")
      .list(tempFolder);
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }
    // Remove all files
    const paths = files.map((f) => `${tempFolder}/${f.name}`);
    const { error: removeError } = await supabase.storage
      .from("listing-images")
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
