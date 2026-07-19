import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  deleteFile,
  getListingImageKeyFromUrl,
} from "@/lib/storage/spaces";
import {
  verifyBusinessOwner,
  verifyListingOwnership,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
    imageId: string;
  }>;
}

/**
 * DELETE /api/business/listings/[id]/gallery/[imageId]
 * Delete an image from listing gallery
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, imageId } = await params;
    const listingId = parseInt(id, 10);
    const imageIdNum = parseInt(imageId, 10);

    if (isNaN(listingId) || isNaN(imageIdNum)) {
      return apiError("Invalid ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    // Verify image belongs to this listing
    const { rows: imageRows } = await query(
      `SELECT id, listing_id, url, is_primary FROM listing_images
       WHERE id = $1 AND listing_id = $2`,
      [imageIdNum, listingId],
    );
    const image = imageRows[0];

    if (!image) {
      return apiError("Image not found or does not belong to this listing", 404);
    }

    // Extract storage path from URL (CDN, legacy hostname, or Supabase)
    const storagePath = getListingImageKeyFromUrl(image.url);

    // Delete from storage when we can resolve a Spaces key
    if (storagePath) {
      try {
        await deleteFile(storagePath);
      } catch (storageError) {
        console.error("Storage deletion error:", storageError);
        // Continue with database deletion even if storage fails
      }
    } else {
      console.warn(
        "[DELETE IMAGE] Could not resolve Spaces key for URL:",
        image.url,
      );
    }

    // Delete from database
    try {
      await query(`DELETE FROM listing_images WHERE id = $1`, [imageIdNum]);
    } catch (dbError) {
      throw new Error(
        `Failed to delete image: ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
      );
    }

    // If this was the primary image, set another as primary
    if (image.is_primary) {
      const { rows: firstImageRows } = await query(
        `SELECT id FROM listing_images WHERE listing_id = $1 ORDER BY display_order ASC LIMIT 1`,
        [listingId],
      );
      const firstImage = firstImageRows[0];

      if (firstImage) {
        await query(`UPDATE listing_images SET is_primary = true WHERE id = $1`, [
          firstImage.id,
        ]);
      }
    }

    return apiSuccess({ deleted: true }, "Image deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
