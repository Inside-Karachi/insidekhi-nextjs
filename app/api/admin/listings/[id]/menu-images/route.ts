import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

/**
 * GET /api/admin/listings/[id]/menu-images
 * Fetches menu images from both:
 * 1. listing_images table (filtered by custom_attributes.peekaboo_type = 'menu')
 * 2. Storage bucket peekaboo/{listingId}/menu/ folder (for scraped images)
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

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const adminSupabase = access.adminSupabase;

    // Fetch the listing to get peekaboo_id
    const { data: listing, error: listingError } = await adminSupabase
      .from("listings")
      .select("peekaboo_id")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
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
              listing_id: listingId,
              url: data.publicUrl,
              alt_text: "Menu image",
              display_order: imageIndex - 1,
              created_at: file.created_at || new Date().toISOString(),
              source: "storage" as const,
            };
          });

        allMenuImages.push(...peekabooImages);
      }
    }

    // Path 2: Check manual upload folder (for manually created listings)
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
            listing_id: listingId,
            url: data.publicUrl,
            alt_text: "Menu image",
            display_order: imageIndex - 1,
            created_at: file.created_at || new Date().toISOString(),
            source: "storage" as const,
          };
        });

      allMenuImages.push(...manualImages);
    }

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
 * Deletes a menu image from both storage and database
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

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const adminSupabase = access.adminSupabase;

    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 },
      );
    }

    // Menu images are stored in storage only, not in database
    // Extract storage path from URL
    const urlMatch = imageUrl.match(
      /\/storage\/v1\/object\/public\/listing-images\/(.+)$/,
    );

    if (!urlMatch) {
      return NextResponse.json(
        { error: "Invalid image URL format" },
        { status: 400 },
      );
    }

    const storagePath = decodeURIComponent(urlMatch[1]);

    const { error: storageDeleteError } = await adminSupabase.storage
      .from("listing-images")
      .remove([storagePath]);

    if (storageDeleteError) {
      console.error("[MENU IMAGES] Storage delete error:", storageDeleteError);
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
