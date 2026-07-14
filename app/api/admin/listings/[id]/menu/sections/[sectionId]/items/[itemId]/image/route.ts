import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/storage/spaces";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      sectionId: string;
      itemId: string;
    }>;
  },
) {
  try {
    const { id, sectionId, itemId } = await params;
    const listingId = parseInt(id);
    const sectionIdNum = parseInt(sectionId);
    const itemIdNum = parseInt(itemId);

    if (isNaN(listingId) || isNaN(sectionIdNum) || isNaN(itemIdNum)) {
      return NextResponse.json(
        { error: "Invalid ID parameters" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Verify the menu item belongs to the listing and section
    const { rows: menuItemRows } = await query(
      `SELECT mi.id, mi.section_id
       FROM menu_items mi
       JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE mi.id = $1 AND mi.section_id = $2 AND ms.listing_id = $3`,
      [itemIdNum, sectionIdNum, listingId],
    );
    const menuItem = menuItemRows[0];

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found or access denied" },
        { status: 404 },
      );
    }

    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const imageUrl = formData.get("url") as string;
    const alt = formData.get("alt") as string;

    let processedFile: File;

    if (file) {
      // Handle direct file upload
      processedFile = file;
    } else if (imageUrl) {
      // Handle URL input - fetch and convert to file
      try {
        // Validate URL format
        const url = new URL(imageUrl);
        if (!url.protocol.startsWith("http")) {
          return NextResponse.json(
            { error: "Invalid URL. Only HTTP and HTTPS URLs are allowed" },
            { status: 400 },
          );
        }

        // Fetch the image
        const response = await fetch(imageUrl, {
          headers: {
            "User-Agent": "Inside-Karachi-Menu-Image-Fetcher/1.0",
          },
          // Set a reasonable timeout
          signal: AbortSignal.timeout(10000), // 10 seconds
        });

        if (!response.ok) {
          return NextResponse.json(
            {
              error: `Failed to fetch image from URL: ${response.status} ${response.statusText}`,
            },
            { status: 400 },
          );
        }

        // Check content type
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.startsWith("image/")) {
          return NextResponse.json(
            { error: "URL does not point to a valid image" },
            { status: 400 },
          );
        }

        // Convert response to blob
        const blob = await response.blob();

        // Validate file size (2MB max for menu items)
        const maxSize = 2 * 1024 * 1024;
        if (blob.size > maxSize) {
          return NextResponse.json(
            { error: "Image from URL is too large. Maximum 2MB allowed" },
            { status: 400 },
          );
        }

        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
        ];
        if (!allowedTypes.includes(contentType)) {
          return NextResponse.json(
            {
              error:
                "Invalid image type from URL. Only JPEG, PNG, and WebP are allowed",
            },
            { status: 400 },
          );
        }

        // Convert blob to file
        const urlObj = new URL(imageUrl);
        const filename = urlObj.pathname.split("/").pop() || "image";
        const extension = contentType.split("/")[1];
        const finalFilename = extension ? `${filename}.${extension}` : filename;

        processedFile = new File([blob], finalFilename, { type: contentType });
      } catch (error) {
        console.error("Error fetching image from URL:", error);
        if (error instanceof Error && error.name === "AbortError") {
          return NextResponse.json(
            { error: "Timeout fetching image from URL" },
            { status: 408 },
          );
        }
        return NextResponse.json(
          {
            error:
              "Failed to fetch image from URL. Please check the URL and try again",
          },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "No file or URL provided" },
        { status: 400 },
      );
    }

    // Generate unique filename with organized folder structure
    // Format: listing-{listingId}/menu-item-{itemId}-{timestamp}.{ext}
    // This provides better organization and easier management of images by listing
    const fileExt = processedFile.name.split(".").pop() || "jpg";
    const fileName = `listing-${listingId}/menu-item-${itemIdNum}-${Date.now()}.${fileExt}`;

    // Upload to DigitalOcean Spaces
    let publicUrl;
    try {
      const buffer = Buffer.from(await processedFile.arrayBuffer());
      const uploadResult = await uploadFile(fileName, buffer, {
        bucket: "menu-item-images",
        contentType: processedFile.type || "application/octet-stream",
      });
      publicUrl = uploadResult.publicUrl;
    } catch (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }

    // Update menu item with image URL and alt text
    let updatedItem;
    try {
      const { rows } = await query(
        `UPDATE menu_items SET image_url = $1, image_alt = $2 WHERE id = $3 RETURNING *`,
        [publicUrl, alt?.trim() || null, itemIdNum],
      );
      updatedItem = rows[0];
    } catch (updateError) {
      console.error("Update error:", updateError);
      // Try to clean up uploaded file
      await deleteFile(fileName, "menu-item-images");

      return NextResponse.json(
        { error: "Failed to update menu item" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedItem.id,
        image_url: updatedItem.image_url,
        image_alt: updatedItem.image_alt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in menu item image upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      sectionId: string;
      itemId: string;
    }>;
  },
) {
  try {
    const { id, sectionId, itemId } = await params;
    const listingId = parseInt(id);
    const sectionIdNum = parseInt(sectionId);
    const itemIdNum = parseInt(itemId);

    if (isNaN(listingId) || isNaN(sectionIdNum) || isNaN(itemIdNum)) {
      return NextResponse.json(
        { error: "Invalid ID parameters" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Get current menu item to extract image URL for cleanup
    // (also verify the item belongs to this listing's section, per the fix above)
    const { rows: menuItemRows } = await query(
      `SELECT mi.image_url
       FROM menu_items mi
       JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE mi.id = $1 AND mi.section_id = $2 AND ms.listing_id = $3`,
      [itemIdNum, sectionIdNum, listingId],
    );
    const menuItem = menuItemRows[0];

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 },
      );
    }

    // Update menu item to remove image
    let updatedItem;
    try {
      const { rows } = await query(
        `UPDATE menu_items SET image_url = NULL, image_alt = NULL WHERE id = $1 RETURNING *`,
        [itemIdNum],
      );
      updatedItem = rows[0];
    } catch (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to remove image" },
        { status: 500 },
      );
    }

    // Clean up file from storage if it exists
    if (menuItem.image_url) {
      try {
        // Extract filename from URL
        const urlParts = menuItem.image_url.split("/");
        const fileName = urlParts[urlParts.length - 1];

        await deleteFile(fileName, "menu-item-images");
      } catch (storageError) {
        console.warn("Failed to clean up storage file:", storageError);
        // Don't fail the request if cleanup fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedItem.id,
        image_url: null,
        image_alt: null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in menu item image delete:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
