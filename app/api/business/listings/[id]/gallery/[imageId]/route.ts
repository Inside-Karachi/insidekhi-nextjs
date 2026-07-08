import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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

    const supabase = await createServerSupabase();

    // Verify image belongs to this listing
    const { data: image, error: fetchError } = await supabase
      .from("listing_images")
      .select("id, listing_id, url, is_primary")
      .eq("id", imageIdNum)
      .eq("listing_id", listingId)
      .single();

    if (fetchError || !image) {
      return apiError("Image not found or does not belong to this listing", 404);
    }

    // Extract storage path from URL
    const urlParts = image.url.split("/listing-images/");
    if (urlParts.length < 2) {
      return apiError("Invalid image URL format", 500);
    }
    const storagePath = urlParts[1];

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("listing-images")
      .remove([storagePath]);

    if (storageError) {
      console.error("Storage deletion error:", storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("listing_images")
      .delete()
      .eq("id", imageIdNum);

    if (dbError) {
      throw new Error(`Failed to delete image: ${dbError.message}`);
    }

    // If this was the primary image, set another as primary
    if (image.is_primary) {
      const { data: firstImage } = await supabase
        .from("listing_images")
        .select("id")
        .eq("listing_id", listingId)
        .order("display_order", { ascending: true })
        .limit(1)
        .single();

      if (firstImage) {
        await supabase
          .from("listing_images")
          .update({ is_primary: true })
          .eq("id", firstImage.id);
      }
    }

    return apiSuccess({ deleted: true }, "Image deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
