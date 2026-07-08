import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

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

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const adminSupabase = access.adminSupabase;

    const body = await request.json();
    // Only allow is_primary and alt_text updates
    const { is_primary, alt_text } = body;

    // If setting is_primary to true, unset for all other images in this listing
    if (is_primary === true) {
      // First, unset all others
      const { error: unsetError } = await adminSupabase
        .from("listing_images")
        .update({ is_primary: false })
        .eq("listing_id", listingId)
        .neq("id", imgId); // Important: exclude the current image

      if (unsetError) {
        return NextResponse.json(
          { error: "Failed to update other images" },
          { status: 500 },
        );
      }
    }

    // Update the target image
    const { data: updated, error: updateError } = await adminSupabase
      .from("listing_images")
      .update({
        is_primary: !!is_primary,
        alt_text: alt_text ?? undefined,
      })
      .eq("id", imgId)
      .eq("listing_id", listingId)
      .select()
      .single();
    if (updateError || !updated) {
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

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const adminSupabase = access.adminSupabase;

    // First, get the image to extract the filename from URL for storage deletion
    const { data: image, error: fetchError } = await adminSupabase
      .from("listing_images")
      .select("url")
      .eq("id", imgId)
      .eq("listing_id", listingId)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Extract filename from URL for storage deletion
    // URL formats:
    // Manual: https://xxx.supabase.co/storage/v1/object/public/listing-images/35/35-file.jpg
    // Peekaboo: https://xxx.supabase.co/storage/v1/object/public/listing-images/peekaboo/35/file.jpg
    // We need everything after "listing-images/"

    const bucketName = "listing-images";
    const bucketMarker = `/storage/v1/object/public/${bucketName}/`;
    const markerIndex = image.url.indexOf(bucketMarker);

    if (markerIndex === -1) {
      console.error(`[DELETE IMAGE] Invalid URL format: ${image.url}`);
      return NextResponse.json(
        { error: "Invalid image URL format" },
        { status: 500 },
      );
    }

    // Extract full path after bucket name (handles both manual and peekaboo folders)
    const fullFileName = image.url.substring(markerIndex + bucketMarker.length);

    if (!fullFileName) {
      console.error(`[DELETE IMAGE] Empty file path for URL: ${image.url}`);
      return NextResponse.json(
        { error: "Could not extract file path from URL" },
        { status: 500 },
      );
    }

    // Delete from database first
    const { error: deleteError } = await adminSupabase
      .from("listing_images")
      .delete()
      .eq("id", imgId)
      .eq("listing_id", listingId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete image from database" },
        { status: 500 },
      );
    }

    // Delete from storage
    console.log(
      "[DELETE IMAGE] Attempting to delete from storage:",
      fullFileName,
    );
    const { error: storageError } = await adminSupabase.storage
      .from("listing-images")
      .remove([fullFileName]);

    if (storageError) {
      console.error("[DELETE IMAGE] Storage deletion failed:", storageError);
      // Don't return error here as DB deletion succeeded
    } else {
      console.log(
        "[DELETE IMAGE] Successfully deleted from storage:",
        fullFileName,
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
