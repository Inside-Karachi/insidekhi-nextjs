import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import {
  deleteFile,
  getListingImageKeyFromUrl,
} from "@/lib/storage/spaces";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const { id, imageId } = await params;
    const listingId = parseInt(id);
    const imgId = parseInt(imageId);
    if (isNaN(listingId) || isNaN(imgId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const body = await request.json();
    // Only allow is_primary and alt_text updates
    const { is_primary, alt_text } = body;

    // If setting is_primary to true, unset for all other images in this listing
    if (is_primary === true) {
      await query(
        `UPDATE listing_images
         SET is_primary = false
         WHERE listing_id = $1 AND id <> $2`,
        [listingId, imgId],
      );
    }

    const { rows: updatedRows } = await query(
      `UPDATE listing_images
       SET is_primary = $1,
           alt_text = COALESCE($2, alt_text)
       WHERE id = $3 AND listing_id = $4
       RETURNING *`,
      [!!is_primary, alt_text ?? null, imgId, listingId],
    );
    const updated = updatedRows[0];

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update image" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Image PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const { id, imageId } = await params;
    const listingId = parseInt(id);
    const imgId = parseInt(imageId);
    if (isNaN(listingId) || isNaN(imgId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const { rows: imageRows } = await query(
      `SELECT id, url FROM listing_images
       WHERE id = $1 AND listing_id = $2`,
      [imgId, listingId],
    );
    const image = imageRows[0];

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const storagePath = getListingImageKeyFromUrl(image.url);

    // Delete from database first
    await query(
      `DELETE FROM listing_images WHERE id = $1 AND listing_id = $2`,
      [imgId, listingId],
    );

    // Delete from storage when we can resolve a Spaces key
    if (storagePath) {
      try {
        console.log(
          "[DELETE IMAGE] Attempting to delete from storage:",
          storagePath,
        );
        await deleteFile(storagePath);
        console.log(
          "[DELETE IMAGE] Successfully deleted from storage:",
          storagePath,
        );
      } catch (storageError) {
        console.error("[DELETE IMAGE] Storage deletion failed:", storageError);
        // Don't return error here as DB deletion succeeded
      }
    } else {
      console.warn(
        "[DELETE IMAGE] Could not resolve Spaces key for URL:",
        image.url,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Image DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
