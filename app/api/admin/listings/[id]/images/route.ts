import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

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

    // Fetch images for this listing
    const { data: images, error: fetchError } = await adminSupabase
      .from("listing_images")
      .select("*")
      .eq("listing_id", listingId)
      .order("display_order", { ascending: true });

    if (fetchError) {
      console.error("Error fetching images:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch images" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: images || [] });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
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

    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed" },
        { status: 400 },
      );
    }
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum 5MB allowed" },
        { status: 400 },
      );
    }
    // Check current image count
    const { count: imageCount, error: countError } = await adminSupabase
      .from("listing_images")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listingId);
    if (countError) {
      return NextResponse.json(
        { error: "Failed to check image count" },
        { status: 500 },
      );
    }
    if ((imageCount || 0) >= 20) {
      return NextResponse.json(
        { error: "Maximum 20 images allowed per listing" },
        { status: 400 },
      );
    }
    // Generate unique filename with folder structure
    const fileExt = file.name.split(".").pop();
    const fileName = `${listingId}/${listingId}-${Date.now()}.${fileExt}`;
    // Upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from("listing-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }
    // Get public URL
    const { data: publicUrlData } = adminSupabase.storage
      .from("listing-images")
      .getPublicUrl(fileName);

    // Get next display order
    const { data: maxOrder } = await adminSupabase
      .from("listing_images")
      .select("display_order")
      .eq("listing_id", listingId)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();
    const nextOrder = (maxOrder?.display_order || 0) + 1;

    // Check if this listing has any primary image already
    const { data: primaryImage } = await adminSupabase
      .from("listing_images")
      .select("id")
      .eq("listing_id", listingId)
      .eq("is_primary", true)
      .limit(1)
      .single();

    // Save to database
    const { data: imageData, error: dbError } = await adminSupabase
      .from("listing_images")
      .insert({
        listing_id: listingId,
        url: publicUrlData.publicUrl,
        alt_text: file.name,
        display_order: nextOrder,
        is_primary: !primaryImage, // Only set as primary if no other primary exists
      })
      .select()
      .single();
    if (dbError) {
      console.error("Database insert error details:", {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
      });
      await adminSupabase.storage.from("listing-images").remove([fileName]);
      return NextResponse.json(
        {
          error: "Failed to save image data",
          details: dbError.message || "Database error occurred",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, data: imageData });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
