import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  verifyBusinessOwner,
  verifyListingOwnership,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const branchSchema = z.object({
  name: z.string().min(3).max(200),
  address: z.string().min(5).max(500),
  phone_number: z
    .string()
    .regex(/^(\+92|92|0)?[0-9]{10}$/, "Invalid Pakistani phone number")
    .optional()
    .nullable(),
  latitude: z.number().min(-90).max(90).default(0),
  longitude: z.number().min(-180).max(180).default(0),
  is_primary: z.boolean().optional(),
});

/**
 * POST /api/business/listings/[id]/branches
 * Add a new branch to the listing
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return apiError("Invalid listing ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    const body = await request.json();
    const validation = branchSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        validation.error.flatten().fieldErrors,
      );
    }

    const branchData = validation.data;

    // If setting as primary, first unset any existing primary
    if (branchData.is_primary) {
      await query(
        `UPDATE listing_branches SET is_primary = false WHERE listing_id = $1`,
        [listingId],
      );
    }

    // Create the branch
    let newBranch;
    try {
      const { rows } = await query(
        `INSERT INTO listing_branches
           (listing_id, name, address, phone_number, latitude, longitude, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          listingId,
          branchData.name,
          branchData.address,
          branchData.phone_number || null,
          branchData.latitude,
          branchData.longitude,
          branchData.is_primary || false,
        ],
      );
      newBranch = rows[0];
    } catch (insertError) {
      throw new Error(
        `Failed to create branch: ${insertError instanceof Error ? insertError.message : "Unknown error"}`,
      );
    }

    return apiSuccess(
      {
        branch: newBranch,
      },
      "Branch created successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/business/listings/[id]/branches
 * Get all branches for a listing
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return apiError("Invalid listing ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    let branches;
    try {
      const result = await query(
        `SELECT * FROM listing_branches
         WHERE listing_id = $1
         ORDER BY is_primary DESC, name ASC`,
        [listingId],
      );
      branches = result.rows;
    } catch (error) {
      throw new Error(
        `Failed to fetch branches: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return apiSuccess({ branches: branches || [] });
  } catch (error) {
    return handleApiError(error);
  }
}
