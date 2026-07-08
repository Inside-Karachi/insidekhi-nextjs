import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { createServerSupabase } from "@/lib/supabase/server";

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

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const adminSupabase = access.adminSupabase;

    // Verify the menu item belongs to the listing and section
    const { data: menuItem, error: itemError } = await adminSupabase
      .from("menu_items")
      .select(
        `
        id,
        section_id,
        menu_sections!inner(listing_id)
      `,
      )
      .eq("id", itemIdNum)
      .eq("section_id", sectionIdNum)
      .single();

    if (itemError || !menuItem) {
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

    // Upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from("menu-item-images")
      .upload(fileName, processedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }

    // Get public URL
    const { data: urlData } = adminSupabase.storage
      .from("menu-item-images")
      .getPublicUrl(fileName);

    if (!urlData.publicUrl) {
      return NextResponse.json(
        { error: "Failed to generate public URL" },
        { status: 500 },
      );
    }

    // Update menu item with image URL and alt text
    const { data: updatedItem, error: updateError } = await adminSupabase
      .from("menu_items")
      .update({
        image_url: urlData.publicUrl,
        image_alt: alt?.trim() || null,
      })
      .eq("id", itemIdNum)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      // Try to clean up uploaded file using service role
      const serviceRoleClient = await createServerSupabase({
        useServiceRole: true,
      });
      await serviceRoleClient.storage
        .from("menu-item-images")
        .remove([fileName]);

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

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const adminSupabase = access.adminSupabase;

    // Get current menu item to extract image URL for cleanup
    const { data: menuItem, error: itemError } = await adminSupabase
      .from("menu_items")
      .select("image_url")
      .eq("id", itemIdNum)
      .single();

    if (itemError || !menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 },
      );
    }

    // Update menu item to remove image
    const { data: updatedItem, error: updateError } = await adminSupabase
      .from("menu_items")
      .update({
        image_url: null,
        image_alt: null,
      })
      .eq("id", itemIdNum)
      .select()
      .single();

    if (updateError) {
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

        // Use service role client for storage deletion
        const serviceRoleClient = await createServerSupabase({
          useServiceRole: true,
        });
        await serviceRoleClient.storage
          .from("menu-item-images")
          .remove([fileName]);
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
