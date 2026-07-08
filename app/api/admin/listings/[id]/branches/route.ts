import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { z } from "zod";
import type { Database } from "@/types/supabase";

type Json =
  Database["public"]["Tables"]["listing_branches"]["Row"]["custom_attributes"];

type BranchInsert = Database["public"]["Tables"]["listing_branches"]["Insert"];
type BranchUpdate = Database["public"]["Tables"]["listing_branches"]["Update"];

// Validation schema for branch data
const BranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone_number: z.string().nullable().optional(),
  is_primary: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  distance_from_center: z.string().nullable().optional(),
  custom_attributes: z.record(z.unknown()).nullable().optional(),
});

/**
 * GET /api/admin/listings/[id]/branches
 * Fetch all branches for a listing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // Fetch branches
    const { data: branches, error } = await supabase
      .from("listing_branches")
      .select("*")
      .eq("listing_id", listingId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Branches API] Error fetching branches:", error);
      return NextResponse.json(
        { error: "Failed to fetch branches" },
        { status: 500 }
      );
    }

    return NextResponse.json({ branches: branches || [] });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[Branches API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/listings/[id]/branches
 * Create a new branch for a listing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = BranchSchema.parse(body);

    // If setting as primary, unset other primary branches for this listing
    if (validatedData.is_primary) {
      const { error: updateError } = await supabase
        .from("listing_branches")
        .update({ is_primary: false })
        .eq("listing_id", listingId)
        .eq("is_primary", true);

      if (updateError) {
        console.error("[Branches API] Error unsetting primary:", updateError);
      }
    }

    // Prepare insert payload with proper typing
    const insertPayload: BranchInsert = {
      listing_id: listingId,
      ...validatedData,
      custom_attributes: validatedData.custom_attributes
        ? (validatedData.custom_attributes as Json)
        : {},
    };

    const { data: branch, error } = await supabase
      .from("listing_branches")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[Branches API] Error creating branch:", error);
      return NextResponse.json(
        { error: "Failed to create branch" },
        { status: 500 }
      );
    }

    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("[Branches API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/listings/[id]/branches
 * Update an existing branch
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // Parse request body
    const body = await request.json();
    const { branch_id, ...rawUpdateData } = body;

    if (!branch_id) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Validate update data
    const validatedData = BranchSchema.partial().parse(rawUpdateData);

    // If setting as primary, unset other primary branches
    if (validatedData.is_primary) {
      const { error: updateError } = await supabase
        .from("listing_branches")
        .update({ is_primary: false })
        .eq("listing_id", listingId)
        .eq("is_primary", true)
        .neq("id", branch_id);

      if (updateError) {
        console.error("[Branches API] Error unsetting primary:", updateError);
      }
    }

    // Prepare update payload with proper typing
    const updatePayload: BranchUpdate = {
      ...validatedData,
      custom_attributes: validatedData.custom_attributes
        ? (validatedData.custom_attributes as Json)
        : undefined,
    };

    const { data: branch, error } = await supabase
      .from("listing_branches")
      .update(updatePayload)
      .eq("id", branch_id)
      .eq("listing_id", listingId)
      .select()
      .single();

    if (error) {
      console.error("[Branches API] Error updating branch:", error);
      return NextResponse.json(
        { error: "Failed to update branch" },
        { status: 500 }
      );
    }

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json({ branch });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("[Branches API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/listings/[id]/branches
 * Delete a branch
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // Parse request body
    const body = await request.json();
    const { branch_id } = body;

    if (!branch_id) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Check if this is the last branch
    const { data: branches } = await supabase
      .from("listing_branches")
      .select("id")
      .eq("listing_id", listingId);

    if (branches && branches.length <= 1) {
      return NextResponse.json(
        {
          error:
            "Cannot delete the last branch. Listing must have at least one branch.",
        },
        { status: 400 }
      );
    }

    // Delete the branch (and cascade delete opening hours)
    const { error } = await supabase
      .from("listing_branches")
      .delete()
      .eq("id", branch_id)
      .eq("listing_id", listingId);

    if (error) {
      console.error("[Branches API] Error deleting branch:", error);
      return NextResponse.json(
        { error: "Failed to delete branch" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[Branches API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
