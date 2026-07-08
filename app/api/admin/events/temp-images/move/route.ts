import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    let dbClient = supabase;
    if (profile.role === "super_admin") {
      storageClient = await createServerSupabase({ useServiceRole: true });
      dbClient = await createServerSupabase({ useServiceRole: true });
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
      return NextResponse.json({ success: true, moved: 0 });
    }

    // Move each file to event folder and insert DB record
    let displayOrder = 1;
    const movedFiles = [];
    for (const file of files) {
      const fromPath = `${tempFolder}/${file.name}`;
      const toPath = `${eventId}/${file.name}`;
      // Copy file
      const { error: copyError } = await storageClient.storage
        .from("event-images")
        .copy(fromPath, toPath);
      if (copyError) {
        return NextResponse.json({ error: copyError.message }, { status: 500 });
      }
      // Remove from temp
      const { error: removeError } = await storageClient.storage
        .from("event-images")
        .remove([fromPath]);
      if (removeError) {
        return NextResponse.json(
          { error: removeError.message },
          { status: 500 }
        );
      }
      // Get public URL
      const { data: publicUrlData } = storageClient.storage
        .from("event-images")
        .getPublicUrl(toPath);
      const publicUrl = publicUrlData?.publicUrl;
      if (typeof publicUrl !== "string") {
        return NextResponse.json(
          { error: "Failed to get public URL" },
          { status: 500 }
        );
      }
      // Insert into event_images
      const { error: dbError } = await dbClient.from("event_images").insert({
        event_id: Number(eventId),
        url: publicUrl,
        alt_text: file.name,
        display_order: displayOrder,
        is_primary: displayOrder === 1,
      });
      if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
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
