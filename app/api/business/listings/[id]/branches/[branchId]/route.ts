import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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

    const supabase = await createServerSupabase();
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
    const { data: existingBranch } = await supabase
      .from("listing_branches")
      .select("id, listing_id, name, is_primary")
      .eq("id", branchIdNum)
      .eq("listing_id", listingId)
      .single();

    if (!existingBranch) {
      return apiError("Branch not found or does not belong to this listing", 404);
    }

    // If setting as primary, unset other primary branches
    if (updateData.is_primary) {
      await supabase
        .from("listing_branches")
        .update({ is_primary: false })
        .eq("listing_id", listingId)
        .neq("id", branchIdNum);
    }

    // Update the branch
    const { data: updatedBranch, error: updateError } = await supabase
      .from("listing_branches")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", branchIdNum)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update branch: ${updateError.message}`);
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

    const supabase = await createServerSupabase();

    // Verify branch belongs to this listing
    const { data: existingBranch } = await supabase
      .from("listing_branches")
      .select("id, listing_id, name, is_primary")
      .eq("id", branchIdNum)
      .eq("listing_id", listingId)
      .single();

    if (!existingBranch) {
      return apiError("Branch not found or does not belong to this listing", 404);
    }

    // Check if branch has reviews (safety check)
    const { count: reviewCount } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("branch_id", branchIdNum);

    if (reviewCount && reviewCount > 0) {
      return apiError(
        `Cannot delete branch "${existingBranch.name}" - it has ${reviewCount} review(s). Consider archiving instead.`,
        400,
        "HAS_REVIEWS",
        { reviewCount },
      );
    }

    // Don't allow deleting the last/only branch
    const { count: branchCount } = await supabase
      .from("listing_branches")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listingId);

    if (branchCount && branchCount <= 1) {
      return apiError(
        "Cannot delete the only branch. Listings must have at least one branch.",
        400,
        "LAST_BRANCH",
      );
    }

    // Delete the branch
    const { error: deleteError } = await supabase
      .from("listing_branches")
      .delete()
      .eq("id", branchIdNum);

    if (deleteError) {
      throw new Error(`Failed to delete branch: ${deleteError.message}`);
    }

    // If this was primary, set another branch as primary
    if (existingBranch.is_primary) {
      const { data: firstBranch } = await supabase
        .from("listing_branches")
        .select("id")
        .eq("listing_id", listingId)
        .limit(1)
        .single();

      if (firstBranch) {
        await supabase
          .from("listing_branches")
          .update({ is_primary: true })
          .eq("id", firstBranch.id);
      }
    }

    return apiSuccess({ deleted: true }, "Branch deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
