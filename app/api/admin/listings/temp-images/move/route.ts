import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

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
  const { tempSessionId, listingId } = parsedBody || {};
  if (!tempSessionId || !listingId) {
    return NextResponse.json(
      { error: "Missing tempSessionId or listingId" },
      { status: 400 }
    );
  }

  try {
    const access = await assertListingRouteAccess({
      listingId: Number(listingId),
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // List all files in temp folder
    const tempFolder = `temp/${tempSessionId}`;
    const { data: files, error: listError } = await supabase.storage
      .from("listing-images")
      .list(tempFolder);
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ success: true, moved: 0 });
    }

    // Move each file to listing folder and insert DB record
    let displayOrder = 1;
    const movedFiles = [];
    for (const file of files) {
      const fromPath = `${tempFolder}/${file.name}`;
      const toPath = `${listingId}/${file.name}`;
      // Copy file
      const { error: copyError } = await supabase.storage
        .from("listing-images")
        .copy(fromPath, toPath);
      if (copyError) {
        return NextResponse.json({ error: copyError.message }, { status: 500 });
      }
      // Remove from temp
      const { error: removeError } = await supabase.storage
        .from("listing-images")
        .remove([fromPath]);
      if (removeError) {
        return NextResponse.json(
          { error: removeError.message },
          { status: 500 }
        );
      }
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("listing-images")
        .getPublicUrl(toPath);
      const publicUrl = publicUrlData?.publicUrl;
      if (typeof publicUrl !== "string") {
        return NextResponse.json(
          { error: "Failed to get public URL" },
          { status: 500 }
        );
      }
      // Insert into listing_images
      const { error: dbError } = await supabase.from("listing_images").insert({
        listing_id: Number(listingId),
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

    // No-op: don't log in production
    return NextResponse.json({ success: true, moved: movedFiles.length });
  } catch (_err) {
    if (_err instanceof Error && _err.name === "ListingRouteAccessError") {
      return toListingAccessResponse(_err);
    }
    // Only log critical API errors in production
    // console.error("[MOVE API] Unexpected error:", _err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
