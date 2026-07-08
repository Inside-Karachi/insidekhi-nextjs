import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

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

    const form = await request.formData();
    const file = form.get("pdf") as unknown as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 },
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 },
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check if there's an existing PDF and delete it before uploading new one
    const { data: existingListing } = await adminSupabase
      .from("listings")
      .select("menu_pdf_url")
      .eq("id", listingId)
      .single();

    if (existingListing?.menu_pdf_url) {
      try {
        // Extract filename from existing URL
        const urlParts = existingListing.menu_pdf_url.split("/");
        const existingFileName = urlParts.slice(-2).join("/"); // Get listingId/filename part

        await adminSupabase.storage
          .from("listing-pdfs")
          .remove([existingFileName]);
        console.log("[menu-pdf] deleted existing file:", existingFileName);
      } catch (deleteError) {
        // Log but don't fail the operation
        console.warn("[menu-pdf] failed to delete existing file:", deleteError);
      }
    }

    // Generate consistent filename (no timestamp to avoid duplicates)
    const fileName = `${listingId}/menu-${listingId}.pdf`;

    // Upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from("listing-pdfs")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[menu-pdf] storage.upload error:", uploadError.message);
      return NextResponse.json(
        { error: "Failed to upload PDF" },
        { status: 500 },
      );
    }

    // Get public URL
    const { data: urlData } = adminSupabase.storage
      .from("listing-pdfs")
      .getPublicUrl(fileName);

    if (!urlData.publicUrl) {
      return NextResponse.json(
        { error: "Failed to get PDF URL" },
        { status: 500 },
      );
    }

    // Update listing with PDF URL
    const { error: updateError } = await adminSupabase
      .from("listings")
      .update({ menu_pdf_url: urlData.publicUrl })
      .eq("id", listingId);

    if (updateError) {
      console.error("[menu-pdf] database update error:", updateError.message);
      // Try to clean up uploaded file using service role
      try {
        const serviceRoleClient = await createServerSupabase({
          useServiceRole: true,
        });
        await serviceRoleClient.storage.from("listing-pdfs").remove([fileName]);
        console.log(
          "[menu-pdf] cleaned up uploaded file after db error:",
          fileName,
        );
      } catch (cleanupError) {
        console.warn(
          "[menu-pdf] failed to cleanup uploaded file:",
          cleanupError,
        );
      }
      return NextResponse.json(
        { error: "Failed to update listing" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        pdf_url: urlData.publicUrl,
        file_name: fileName,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[menu-pdf] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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

    // Get current PDF URL to extract filename
    const { data: listing, error: fetchError } = await adminSupabase
      .from("listings")
      .select("menu_pdf_url")
      .eq("id", listingId)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Update listing to remove PDF URL
    const { error: updateError } = await adminSupabase
      .from("listings")
      .update({ menu_pdf_url: null })
      .eq("id", listingId);

    if (updateError) {
      console.error("[menu-pdf] database update error:", updateError.message);
      return NextResponse.json(
        { error: "Failed to remove PDF" },
        { status: 500 },
      );
    }

    // Try to delete file from storage if it exists
    if (listing.menu_pdf_url) {
      try {
        // Extract filename from URL - handle different URL formats
        const url = new URL(listing.menu_pdf_url);
        const pathParts = url.pathname.split("/");
        // Find the part after 'listing-pdfs' in the path
        const listingPdfsIndex = pathParts.findIndex(
          (part) => part === "listing-pdfs",
        );
        if (
          listingPdfsIndex !== -1 &&
          pathParts.length > listingPdfsIndex + 1
        ) {
          const fileName = pathParts.slice(listingPdfsIndex + 1).join("/");
          console.log("[menu-pdf] attempting to delete file:", fileName);
          // Use service role client for storage deletion
          const serviceRoleClient = await createServerSupabase({
            useServiceRole: true,
          });
          await serviceRoleClient.storage
            .from("listing-pdfs")
            .remove([fileName]);
          console.log("[menu-pdf] successfully deleted file:", fileName);
        } else {
          console.warn(
            "[menu-pdf] could not extract filename from URL:",
            listing.menu_pdf_url,
          );
        }
      } catch (storageError) {
        // Log but don't fail the operation
        console.warn(
          "[menu-pdf] failed to delete file from storage:",
          storageError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Menu PDF removed successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[menu-pdf] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
