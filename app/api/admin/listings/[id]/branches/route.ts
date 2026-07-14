import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import { z } from "zod";

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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Fetch branches
    let branches;
    try {
      const result = await query(
        `SELECT * FROM listing_branches WHERE listing_id = $1
         ORDER BY is_primary DESC, created_at ASC`,
        [listingId],
      );
      branches = result.rows;
    } catch (error) {
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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Parse and validate request body
    const body = await request.json();
    const validatedData = BranchSchema.parse(body);

    // If setting as primary, unset other primary branches for this listing
    if (validatedData.is_primary) {
      try {
        await query(
          `UPDATE listing_branches SET is_primary = false WHERE listing_id = $1 AND is_primary = true`,
          [listingId],
        );
      } catch (updateError) {
        console.error("[Branches API] Error unsetting primary:", updateError);
      }
    }

    let branch;
    try {
      const { rows } = await query(
        `INSERT INTO listing_branches (
           listing_id, name, address, city, country, latitude, longitude,
           phone_number, is_primary, is_verified, distance_from_center, custom_attributes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          listingId,
          validatedData.name,
          validatedData.address,
          validatedData.city,
          validatedData.country,
          validatedData.latitude,
          validatedData.longitude,
          validatedData.phone_number ?? null,
          validatedData.is_primary,
          validatedData.is_verified,
          validatedData.distance_from_center ?? null,
          JSON.stringify(validatedData.custom_attributes ?? {}),
        ],
      );
      branch = rows[0];
    } catch (error) {
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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

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
      try {
        await query(
          `UPDATE listing_branches SET is_primary = false
           WHERE listing_id = $1 AND is_primary = true AND id != $2`,
          [listingId, branch_id],
        );
      } catch (updateError) {
        console.error("[Branches API] Error unsetting primary:", updateError);
      }
    }

    // Only known, whitelisted BranchSchema fields are used as column names here.
    const updateKeys = Object.keys(validatedData) as Array<
      keyof typeof validatedData
    >;
    let branch;
    if (updateKeys.length === 0) {
      const { rows } = await query(
        `SELECT * FROM listing_branches WHERE id = $1 AND listing_id = $2`,
        [branch_id, listingId],
      );
      branch = rows[0];
    } else {
      const setClauses = updateKeys.map((key, idx) => `"${key}" = $${idx + 1}`);
      const values: unknown[] = updateKeys.map((key) => {
        const value = validatedData[key];
        return key === "custom_attributes" ? JSON.stringify(value ?? {}) : value;
      });
      values.push(branch_id, listingId);

      try {
        const { rows } = await query(
          `UPDATE listing_branches SET ${setClauses.join(", ")}
           WHERE id = $${values.length - 1} AND listing_id = $${values.length}
           RETURNING *`,
          values,
        );
        branch = rows[0];
      } catch (error) {
        console.error("[Branches API] Error updating branch:", error);
        return NextResponse.json(
          { error: "Failed to update branch" },
          { status: 500 }
        );
      }
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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

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
    const { rows: branches } = await query(
      `SELECT id FROM listing_branches WHERE listing_id = $1`,
      [listingId],
    );

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
    try {
      await query(
        `DELETE FROM listing_branches WHERE id = $1 AND listing_id = $2`,
        [branch_id, listingId],
      );
    } catch (error) {
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
