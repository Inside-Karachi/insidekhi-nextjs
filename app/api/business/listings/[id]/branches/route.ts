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

    const supabase = await createServerSupabase();
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
      await supabase
        .from("listing_branches")
        .update({ is_primary: false })
        .eq("listing_id", listingId);
    }

    // Create the branch
    const { data: newBranch, error: insertError } = await supabase
      .from("listing_branches")
      .insert({
        listing_id: listingId,
        name: branchData.name,
        address: branchData.address,
        phone_number: branchData.phone_number || null,
        latitude: branchData.latitude,
        longitude: branchData.longitude,
        is_primary: branchData.is_primary || false,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create branch: ${insertError.message}`);
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

    const supabase = await createServerSupabase();

    const { data: branches, error } = await supabase
      .from("listing_branches")
      .select("*")
      .eq("listing_id", listingId)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }

    return apiSuccess({ branches: branches || [] });
  } catch (error) {
    return handleApiError(error);
  }
}
