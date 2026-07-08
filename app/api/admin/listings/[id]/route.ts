import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { deleteListing } from "@/lib/utils/listing-deletion";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

const ROUTE = "/api/admin/listings/[id]";

function createRequestId(): string {
  return crypto.randomUUID();
}

function patchErrorResponse(
  requestId: string,
  status: number,
  code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "UPDATE_FAILED" | "INTERNAL_ERROR",
  error: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      success: false,
      code,
      error,
      ...(details ? { details } : {}),
      requestId,
    },
    {
      status,
      headers: {
        "x-request-id": requestId,
      },
    },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabase();

    // Check if user is admin or lister
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin or lister role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      (profile?.role !== "admin" &&
        profile?.role !== "super_admin" &&
        profile?.role !== "lister")
    ) {
      return NextResponse.json(
        { error: "Admin or lister access required" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    const { data: listing, error } = await supabase
      .from("listings_with_details")
      .select("*")
      .eq("id", listingId)
      .single();

    if (error) {
      console.error("Error fetching listing:", error);
      captureRouteError(error, { route: ROUTE, method: "GET" });
      return NextResponse.json(
        { error: "Failed to fetch listing" },
        { status: 500 },
      );
    }

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Get listing images
    const { data: images, error: imagesError } = await supabase
      .from("listing_images")
      .select("*")
      .eq("listing_id", listingId)
      .order("display_order", { ascending: true });

    if (imagesError) {
      console.error("Error fetching listing images:", imagesError);
      // Don't fail the request if images can't be fetched
    }

    return NextResponse.json({
      success: true,
      data: {
        listing,
        images: images || [],
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();
  try {
    const supabase = await createServerSupabase();

    // Check if user is admin or lister
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin or lister role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      (profile?.role !== "admin" &&
        profile?.role !== "super_admin" &&
        profile?.role !== "lister")
    ) {
      return patchErrorResponse(
        requestId,
        403,
        "FORBIDDEN",
        "Admin or lister access required",
      );
    }

    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return patchErrorResponse(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Invalid listing ID",
      );
    }

    const body = await request.json();
    const { data: existingListing, error: fetchError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (fetchError) {
      console.error("Error fetching existing listing for update:", fetchError);
      if (
        fetchError.code === "42501" ||
        fetchError.message?.includes("permission denied")
      ) {
        return patchErrorResponse(
          requestId,
          403,
          "FORBIDDEN",
          "Permission denied while loading listing for update",
          { dbCode: fetchError.code ?? null },
        );
      }
      return patchErrorResponse(
        requestId,
        500,
        "INTERNAL_ERROR",
        "Failed to load listing for update",
        { dbCode: fetchError.code ?? null },
      );
    }

    if (!existingListing) {
      return patchErrorResponse(
        requestId,
        404,
        "NOT_FOUND",
        "Listing not found for update",
      );
    }

    const hasOptimisticLock = !!body.expected_updated_at;

    // Merge existing data with new data
    const updateData: Record<string, string | number | null | boolean> = {
      name: body.name !== undefined ? body.name.trim() : existingListing.name,
      slug:
        body.name !== undefined
          ? body.name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
          : existingListing.slug,
      description:
        body.description !== undefined
          ? body.description?.trim() || null
          : existingListing.description,
      address:
        body.address !== undefined
          ? body.address?.trim() || null
          : existingListing.address,
      phone_number:
        body.phone !== undefined
          ? body.phone?.trim() || null
          : existingListing.phone_number,
      email:
        body.email !== undefined
          ? body.email?.trim() || null
          : existingListing.email,
      website:
        body.website !== undefined
          ? body.website?.trim() || null
          : existingListing.website,
      category_id:
        body.category_id !== undefined
          ? parseInt(body.category_id)
          : existingListing.category_id,
      latitude:
        body.latitude !== undefined
          ? body.latitude
            ? parseFloat(body.latitude)
            : null
          : existingListing.latitude,
      longitude:
        body.longitude !== undefined
          ? body.longitude
            ? parseFloat(body.longitude)
            : null
          : existingListing.longitude,
      is_featured:
        body.is_featured !== undefined
          ? body.is_featured
          : existingListing.is_featured,
      status: body.status !== undefined ? body.status : existingListing.status,
      show_member_badge:
        body.show_member_badge !== undefined
          ? body.show_member_badge
          : existingListing.show_member_badge,
      custom_attributes:
        body.custom_attributes !== undefined
          ? body.custom_attributes
          : existingListing.custom_attributes,
      // Social Links
      facebook_url:
        body.facebook_url !== undefined
          ? body.facebook_url?.trim() || null
          : existingListing.facebook_url,
      instagram_url:
        body.instagram_url !== undefined
          ? body.instagram_url?.trim() || null
          : existingListing.instagram_url,
      whatsapp_number:
        body.whatsapp_number !== undefined
          ? body.whatsapp_number?.trim() || null
          : existingListing.whatsapp_number,
      youtube_url:
        body.youtube_url !== undefined
          ? body.youtube_url?.trim() || null
          : existingListing.youtube_url,
      google_maps_url:
        body.google_maps_url !== undefined
          ? body.google_maps_url?.trim() || null
          : existingListing.google_maps_url,
      place_id:
        body.place_id !== undefined
          ? body.place_id?.trim() || null
          : existingListing.place_id,
      parking_information:
        body.parking_information !== undefined
          ? body.parking_information?.trim() || null
          : existingListing.parking_information,
      parking_amenities:
        body.parking_amenities !== undefined
          ? body.parking_amenities
          : existingListing.parking_amenities,
    };

    // Validate required fields
    if (!updateData.name || !updateData.slug) {
      return patchErrorResponse(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Missing required fields: name or slug",
      );
    }

    let query = supabase
      .from("listings")
      .update(updateData)
      .eq("id", listingId);

    // Atomic CAS: only update if updated_at hasn't changed since the client loaded
    if (hasOptimisticLock) {
      query = query.eq("updated_at", body.expected_updated_at);
    }

    const { data: listing, error } = await query.select().single();

    if (error) {
      console.error("Error updating listing:", error);
      const isValidationError = error.code === "23503" || error.code === "22P02";
      if (!isValidationError) {
        captureRouteError(error, { route: ROUTE, method: "PATCH" });
      }
      return patchErrorResponse(
        requestId,
        isValidationError ? 400 : 500,
        isValidationError ? "VALIDATION_ERROR" : "UPDATE_FAILED",
        "Failed to update listing",
        {
          dbCode: error.code ?? null,
        },
      );
    }

    if (!listing) {
      if (hasOptimisticLock) {
        return patchErrorResponse(
          requestId,
          409,
          "UPDATE_FAILED",
          "This listing was modified by another user. Please reload and try again.",
          { reason: "optimistic_lock_conflict" },
        );
      }
      return patchErrorResponse(
        requestId,
        404,
        "NOT_FOUND",
        "Listing not found or was deleted",
      );
    }

    // Log the admin action
    try {
      const { logListingUpdate } = await import("@/lib/audit");
      await logListingUpdate(
        user.id,
        listingId.toString(),
        existingListing,
        listing,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log listing update:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({ success: true, data: { listing } });
  } catch (error) {
    console.error("Unexpected error:", error);
    captureRouteError(error, { route: ROUTE, method: "PATCH" });
    return patchErrorResponse(
      requestId,
      500,
      "INTERNAL_ERROR",
      "Internal server error",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabase();

    // Check if user is admin or lister
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin or lister role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      (profile?.role !== "admin" &&
        profile?.role !== "super_admin" &&
        profile?.role !== "lister")
    ) {
      return NextResponse.json(
        { error: "Admin or lister access required" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    // Get listing data before deletion for logging
    const { data: listingToDelete, error: fetchError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (fetchError || !listingToDelete) {
      console.error("Error fetching listing for deletion:", fetchError);
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Use service role for storage operations
    const serviceRoleClient = await createServerSupabase({
      useServiceRole: true,
    });

    // Use centralized deletion utility
    const deletionResult = await deleteListing(serviceRoleClient, listingId);

    if (!deletionResult.success) {
      const statusCode = deletionResult.error?.includes("change requests")
        ? 409
        : 500;
      if (statusCode >= 500) {
        captureRouteError(
          new Error(deletionResult.error ?? "Failed to delete listing"),
          { route: ROUTE, method: "DELETE" },
        );
      }
      return NextResponse.json(
        {
          error: deletionResult.error || "Failed to delete listing",
          details: deletionResult.restrictionErrors,
        },
        { status: statusCode },
      );
    }

    // Log the admin action
    try {
      const { logListingDeletion } = await import("@/lib/audit");
      await logListingDeletion(
        user.id,
        listingId.toString(),
        listingToDelete,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log listing deletion:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Listing and all associated images deleted successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    captureRouteError(error, { route: ROUTE, method: "DELETE" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
