import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import { listFiles, getPublicUrl, deleteFile } from "@/lib/storage/spaces";

const MENU_IMAGES_BUCKET = "listing-images";

/**
 * GET /api/admin/listings/[id]/menu-images
 * Fetches menu images from storage:
 * 1. peekaboo/{peekaboo_id}/menu/ folder (for scraped listings)
 * 2. {listing_id}/menu/ folder (for manually created listings)
 */
export async function GET(
  request: NextRequest,
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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Fetch the listing to get peekaboo_id
    const { rows: listingRows } = await query(
      `SELECT peekaboo_id FROM listings WHERE id = $1`,
      [listingId],
    );
    const listing = listingRows[0];

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Check both storage paths:
    // 1. Scraped listings: peekaboo/{peekaboo_id}/menu/
    // 2. Manual listings: {listing_id}/menu/
    const allMenuImages: Array<{
      id: number;
      listing_id: number;
      url: string;
      alt_text: string;
      display_order: number;
      created_at: string;
      source: "storage";
    }> = [];

    let imageIndex = 0;

    // Path 1: Check peekaboo folder (for scraped listings)
    if (listing.peekaboo_id) {
      const peekabooPath = `peekaboo/${listing.peekaboo_id}/menu`;
      const peekabooFiles = await listFiles(peekabooPath, MENU_IMAGES_BUCKET);

      const peekabooImages = peekabooFiles
        .map((key) => key.split("/").pop() ?? "")
        .filter((name) => name && !name.startsWith("."))
        .map((name) => ({
          id: -1 * ++imageIndex,
          listing_id: listingId,
          url: getPublicUrl(`${peekabooPath}/${name}`, MENU_IMAGES_BUCKET),
          alt_text: "Menu image",
          display_order: imageIndex - 1,
          created_at: new Date().toISOString(),
          source: "storage" as const,
        }));

      allMenuImages.push(...peekabooImages);
    }

    // Path 2: Check manual upload folder (for manually created listings)
    const manualPath = `${listingId}/menu`;
    const manualFiles = await listFiles(manualPath, MENU_IMAGES_BUCKET);

    const manualImages = manualFiles
      .map((key) => key.split("/").pop() ?? "")
      .filter((name) => name && !name.startsWith("."))
      .map((name) => ({
        id: -1 * ++imageIndex,
        listing_id: listingId,
        url: getPublicUrl(`${manualPath}/${name}`, MENU_IMAGES_BUCKET),
        alt_text: "Menu image",
        display_order: imageIndex - 1,
        created_at: new Date().toISOString(),
        source: "storage" as const,
      }));

    allMenuImages.push(...manualImages);

    return NextResponse.json({
      success: true,
      data: allMenuImages,
      count: allMenuImages.length,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[MENU IMAGES] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/listings/[id]/menu-images
 * Deletes a menu image from storage
 */
export async function DELETE(
  request: NextRequest,
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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 },
      );
    }

    // Menu images are stored in storage only, not in database.
    // Extract the storage key from the CDN/public URL.
    const urlMatch = imageUrl.match(
      /digitaloceanspaces\.com\/(.+)$/,
    );

    if (!urlMatch) {
      return NextResponse.json(
        { error: "Invalid image URL format" },
        { status: 400 },
      );
    }

    const storagePath = decodeURIComponent(urlMatch[1]);

    try {
      await deleteFile(storagePath, MENU_IMAGES_BUCKET);
    } catch (storageError) {
      console.error("[MENU IMAGES] Storage delete error:", storageError);
      return NextResponse.json(
        { error: "Failed to delete image from storage" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Menu image deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[MENU IMAGES] Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
