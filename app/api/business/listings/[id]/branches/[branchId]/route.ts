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
    branchId: string;
  }>;
}

const branchUpdateSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  address: z.string().min(5).max(500).optional(),
  phone_number: z
    .string()
    .regex(/^(\+92|92|0)?[0-9]{10}$/, "Invalid Pakistani phone number")
    .optional()
    .nullable(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_primary: z.boolean().optional(),
});

/**
 * PATCH /api/business/listings/[id]/branches/[branchId]
 * Update a branch
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, branchId } = await params;
    const listingId = parseInt(id, 10);
    const branchIdNum = parseInt(branchId, 10);

    if (isNaN(listingId) || isNaN(branchIdNum)) {
      return apiError("Invalid ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    const body = await request.json();
    const validation = branchUpdateSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        validation.error.flatten().fieldErrors,
      );
    }

    const updateData = validation.data;

    // Verify branch belongs to this listing
    const { rows: existingBranchRows } = await query(
      `SELECT id, listing_id, name, is_primary FROM listing_branches
       WHERE id = $1 AND listing_id = $2`,
      [branchIdNum, listingId],
    );
    const existingBranch = existingBranchRows[0];

    if (!existingBranch) {
      return apiError("Branch not found or does not belong to this listing", 404);
    }

    // If setting as primary, unset other primary branches
    if (updateData.is_primary) {
      await query(
        `UPDATE listing_branches SET is_primary = false WHERE listing_id = $1 AND id != $2`,
        [listingId, branchIdNum],
      );
    }

    // Update the branch
    const updateKeys = Object.keys(updateData);
    const setClauses = updateKeys.map((key, idx) => `"${key}" = $${idx + 1}`);
    setClauses.push(`updated_at = $${updateKeys.length + 1}`);
    const values = [
      ...updateKeys.map((key) => (updateData as Record<string, unknown>)[key]),
      new Date().toISOString(),
      branchIdNum,
    ];

    let updatedBranch;
    try {
      const { rows } = await query(
        `UPDATE listing_branches SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      updatedBranch = rows[0];
    } catch (updateError) {
      throw new Error(
        `Failed to update branch: ${updateError instanceof Error ? updateError.message : "Unknown error"}`,
      );
    }

    return apiSuccess(updatedBranch, "Branch updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/business/listings/[id]/branches/[branchId]
 * Delete a branch (with safety checks for reviews)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, branchId } = await params;
    const listingId = parseInt(id, 10);
    const branchIdNum = parseInt(branchId, 10);

    if (isNaN(listingId) || isNaN(branchIdNum)) {
      return apiError("Invalid ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    // Verify branch belongs to this listing
    const { rows: existingBranchRows } = await query(
      `SELECT id, listing_id, name, is_primary FROM listing_branches
       WHERE id = $1 AND listing_id = $2`,
      [branchIdNum, listingId],
    );
    const existingBranch = existingBranchRows[0];

    if (!existingBranch) {
      return apiError("Branch not found or does not belong to this listing", 404);
    }

    // Check if branch has reviews (safety check)
    const { rows: reviewCountRows } = await query(
      `SELECT COUNT(*) FROM reviews WHERE branch_id = $1`,
      [branchIdNum],
    );
    const reviewCount = parseInt(reviewCountRows[0].count, 10);

    if (reviewCount && reviewCount > 0) {
      return apiError(
        `Cannot delete branch "${existingBranch.name}" - it has ${reviewCount} review(s). Consider archiving instead.`,
        400,
        "HAS_REVIEWS",
        { reviewCount },
      );
    }

    // Don't allow deleting the last/only branch
    const { rows: branchCountRows } = await query(
      `SELECT COUNT(*) FROM listing_branches WHERE listing_id = $1`,
      [listingId],
    );
    const branchCount = parseInt(branchCountRows[0].count, 10);

    if (branchCount && branchCount <= 1) {
      return apiError(
        "Cannot delete the only branch. Listings must have at least one branch.",
        400,
        "LAST_BRANCH",
      );
    }

    // Delete the branch
    try {
      await query(`DELETE FROM listing_branches WHERE id = $1`, [branchIdNum]);
    } catch (deleteError) {
      throw new Error(
        `Failed to delete branch: ${deleteError instanceof Error ? deleteError.message : "Unknown error"}`,
      );
    }

    // If this was primary, set another branch as primary
    if (existingBranch.is_primary) {
      const { rows: firstBranchRows } = await query(
        `SELECT id FROM listing_branches WHERE listing_id = $1 LIMIT 1`,
        [listingId],
      );
      const firstBranch = firstBranchRows[0];

      if (firstBranch) {
        await query(
          `UPDATE listing_branches SET is_primary = true WHERE id = $1`,
          [firstBranch.id],
        );
      }
    }

    return apiSuccess({ deleted: true }, "Branch deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
