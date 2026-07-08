import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

/**
 * Opening Hours Input Type
 *
 * The frontend sends hours with dayOfWeek in database format (0=Sunday)
 * but displays them Monday-first using transformation functions.
 */
type OpeningHoursInput = {
  dayOfWeek: number; // Database format: 0=Sunday, 1=Monday, ..., 6=Saturday
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  branch_id?: number | null; // FK to listing_branches (preserve branch association)
};

// GET: Fetch opening hours for a listing
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
    const supabase = access.adminSupabase;

    // Check if requesting hours for a specific branch
    const { searchParams } = new URL(request.url);
    const branchIdParam = searchParams.get("branch_id");

    // Build query with optional branch filter
    let query = supabase
      .from("opening_hours")
      .select("*")
      .eq("listing_id", listingId);

    // Filter by branch_id if provided (for multi-location listings)
    if (branchIdParam) {
      const branchId = parseInt(branchIdParam);
      if (!isNaN(branchId)) {
        query = query.eq("branch_id", branchId);
      }
    }

    const { data: hours, error } = await query.order("day_of_week", {
      ascending: true,
    });

    if (hours && hours.length > 0) {
    }
    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch opening hours" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, data: hours });
  } catch (_error) {
    if (_error instanceof Error && _error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(_error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH: Update opening hours for a listing
export async function PATCH(
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
    const supabase = access.adminSupabase;

    const body = await request.json();

    if (!Array.isArray(body.opening_hours)) {
      console.error(
        "PATCH /opening-hours: opening_hours is not an array",
        body,
      );
      return NextResponse.json(
        { error: "Invalid opening hours format" },
        { status: 400 },
      );
    }

    // Determine which branch we're updating
    // If all hours have the same branch_id, we're editing a specific branch
    // If branch_ids are null/undefined, we're editing legacy single-location hours
    const branchIds = body.opening_hours
      .map((h: OpeningHoursInput) => h.branch_id)
      .filter(
        (id: number | null | undefined) => id !== null && id !== undefined,
      );

    const uniqueBranchIds = [...new Set(branchIds)];
    const isEditingSingleBranch = uniqueBranchIds.length === 1;
    const branchIdToUpdate: number | null = isEditingSingleBranch
      ? (uniqueBranchIds[0] as number)
      : null;

    // Check if payload is ALL legacy (branch_id = null)
    const allLegacy = body.opening_hours.every(
      (h: OpeningHoursInput) =>
        h.branch_id === null || h.branch_id === undefined,
    );

    // Check listing status to determine validation requirements
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("status")
      .eq("id", listingId)
      .single();

    if (listingError) {
      console.error(
        "PATCH /opening-hours: Failed to fetch listing",
        listingError,
      );
      return NextResponse.json(
        { error: "Failed to fetch listing status" },
        { status: 500 },
      );
    }

    // Validate each row - only require times for published listings
    // dayOfWeek should be in database format: 0=Sunday through 6=Saturday
    for (const [i, row] of body.opening_hours.entries()) {
      if (
        typeof row.dayOfWeek !== "number" ||
        row.dayOfWeek < 0 ||
        row.dayOfWeek > 6
      ) {
        console.error(
          `PATCH /opening-hours: Invalid dayOfWeek at index ${i}`,
          row,
        );
        return NextResponse.json(
          { error: `Invalid opening hour at index ${i}` },
          { status: 400 },
        );
      }

      // If the listing is published, we should require both open and close times
      // only when at least one of them is provided, and the day is not marked closed.
      if (listing.status === "published" && row.isClosed !== true) {
        const openEmpty = !row.openTime;
        const closeEmpty = !row.closeTime;

        // If both empty -> optional, allow
        if (openEmpty && closeEmpty) continue;

        // If one is missing -> invalid
        if (openEmpty || closeEmpty) {
          console.error(
            `PATCH /opening-hours: Incomplete times at index ${i}`,
            row,
          );
          return NextResponse.json(
            { error: `Invalid opening hour at index ${i}` },
            { status: 400 },
          );
        }
      }
    }
    // Delete existing opening hours for this listing
    // CRITICAL: Only delete hours for the branch being edited to avoid data loss!
    // First, log what we're about to delete
    let deleteQuery = supabase
      .from("opening_hours")
      .select("*")
      .eq("listing_id", listingId);

    // If editing a specific branch, only fetch hours for that branch
    if (isEditingSingleBranch && branchIdToUpdate !== null) {
      deleteQuery = deleteQuery.eq("branch_id", branchIdToUpdate);
    } else if (allLegacy) {
      // Legacy mode: Only delete hours with branch_id = null
      deleteQuery = deleteQuery.is("branch_id", null);
    } else {
    }

    const { data: existingHours } = await deleteQuery;
    if (existingHours && existingHours.length > 0) {
    }

    // Execute deletion with same filter
    let deleteExecQuery = supabase
      .from("opening_hours")
      .delete()
      .eq("listing_id", listingId);

    // Apply branch filter if editing single branch to preserve other branches' hours
    if (isEditingSingleBranch && branchIdToUpdate !== null) {
      deleteExecQuery = deleteExecQuery.eq("branch_id", branchIdToUpdate);
    } else if (allLegacy) {
      // Legacy mode: Only delete hours with branch_id = null
      deleteExecQuery = deleteExecQuery.is("branch_id", null);
    }

    const { error: deleteError } = await deleteExecQuery;

    if (deleteError) {
      console.error("[OPENING HOURS API] Delete failed:", deleteError);
      console.error(
        "PATCH /opening-hours: Failed to delete existing rows",
        deleteError,
      );
      return NextResponse.json(
        { error: "Failed to delete existing opening hours" },
        { status: 500 },
      );
    }
    // Insert new opening hours
    // Data is already in correct database format (0=Sunday) from frontend
    const insertRows = body.opening_hours.map((row: OpeningHoursInput) => ({
      listing_id: listingId,
      day_of_week: row.dayOfWeek, // Database format: 0=Sunday, 1=Monday, etc.
      open_time: row.isClosed ? null : row.openTime,
      close_time: row.isClosed ? null : row.closeTime,
      is_closed: !!row.isClosed,
      branch_id: row.branch_id ?? null, // Preserve branch association (critical for multi-location)
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from("opening_hours")
      .insert(insertRows)
      .select();

    if (insertError) {
      console.error(
        "PATCH /opening-hours: Failed to insert rows",
        insertError,
        insertRows,
      );
      console.error("[OPENING HOURS API] Insert error details:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      return NextResponse.json(
        { error: "Failed to update opening hours" },
        { status: 500 },
      );
    }
    if (insertedData && insertedData.length > 0) {
    }

    // Verify what's actually in the database now
    const { data: verifyHours } = await supabase
      .from("opening_hours")
      .select("*")
      .eq("listing_id", listingId);
    if (verifyHours && verifyHours.length > 0) {
    }

    return NextResponse.json({
      success: true,
      inserted: insertedData?.length || 0,
    });
  } catch (_error) {
    if (_error instanceof Error && _error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(_error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
