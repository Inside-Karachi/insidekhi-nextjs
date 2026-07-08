import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/listings/[id]/menu-images (PUBLIC)
 * Fetches menu images for a listing (public access for frontend)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    // Fetch the listing to verify it exists and is published
    const { data: listing, error: listingError } = await adminSupabase
      .from("listings")
      .select("peekaboo_id, status")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Only show images for published listings on frontend
    if (listing.status !== "published") {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const allMenuImages: Array<{
      id: number;
      url: string;
      alt_text: string;
      display_order: number;
    }> = [];

    let imageIndex = 0;

    // Check peekaboo folder (scraped listings)
    if (listing.peekaboo_id) {
      const peekabooPath = `peekaboo/${listing.peekaboo_id}/menu`;
      const { data: peekabooFiles } = await adminSupabase.storage
        .from("listing-images")
        .list(peekabooPath);

      if (peekabooFiles && peekabooFiles.length > 0) {
        const peekabooImages = peekabooFiles
          .filter((file) => file.name && !file.name.startsWith("."))
          .map((file) => {
            const { data } = adminSupabase.storage
              .from("listing-images")
              .getPublicUrl(`${peekabooPath}/${file.name}`);

            return {
              id: -1 * ++imageIndex,
              url: data.publicUrl,
              alt_text: "Menu image",
              display_order: imageIndex - 1,
            };
          });

        allMenuImages.push(...peekabooImages);
      }
    }

    // Check manual upload folder
    const manualPath = `${listingId}/menu`;
    const { data: manualFiles } = await adminSupabase.storage
      .from("listing-images")
      .list(manualPath);

    if (manualFiles && manualFiles.length > 0) {
      const manualImages = manualFiles
        .filter((file) => file.name && !file.name.startsWith("."))
        .map((file) => {
          const { data } = adminSupabase.storage
            .from("listing-images")
            .getPublicUrl(`${manualPath}/${file.name}`);

          return {
            id: -1 * ++imageIndex,
            url: data.publicUrl,
            alt_text: "Menu image",
            display_order: imageIndex - 1,
          };
        });

      allMenuImages.push(...manualImages);
    }

    return NextResponse.json({
      success: true,
      data: allMenuImages,
    });
  } catch (error) {
    console.error("[MENU IMAGES] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
