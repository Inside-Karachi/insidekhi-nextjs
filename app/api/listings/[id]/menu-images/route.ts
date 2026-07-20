import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { listFiles, getPublicUrl } from "@/lib/storage/spaces";

const MENU_IMAGES_BUCKET = "listing-images";

/**
 * GET /api/listings/[id]/menu-images (PUBLIC)
 * Fetches menu images for a listing (public access for frontend)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    // Fetch the listing to verify it exists and is published
    const { rows } = await query(
      `SELECT peekaboo_id, status FROM listings WHERE id = $1`,
      [listingId],
    );
    const listing = rows[0];

    if (!listing) {
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
      const peekabooFiles = await listFiles(peekabooPath, MENU_IMAGES_BUCKET);

      const peekabooImages = peekabooFiles
        .map((key) => key.split("/").pop() ?? "")
        .filter((name) => name && !name.startsWith("."))
        .map((name) => ({
          id: -1 * ++imageIndex,
          url: getPublicUrl(`${peekabooPath}/${name}`, MENU_IMAGES_BUCKET),
          alt_text: "Menu image",
          display_order: imageIndex - 1,
        }));

      allMenuImages.push(...peekabooImages);
    }

    // Check manual upload folder
    const manualPath = `${listingId}/menu`;
    const manualFiles = await listFiles(manualPath, MENU_IMAGES_BUCKET);

    const manualImages = manualFiles
      .map((key) => key.split("/").pop() ?? "")
      .filter((name) => name && !name.startsWith("."))
      .map((name) => ({
        id: -1 * ++imageIndex,
        url: getPublicUrl(`${manualPath}/${name}`, MENU_IMAGES_BUCKET),
        alt_text: "Menu image",
        display_order: imageIndex - 1,
      }));

    allMenuImages.push(...manualImages);

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
