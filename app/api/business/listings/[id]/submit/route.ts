import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  verifyBusinessOwner,
  verifyListingOwnership,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/business/listings/[id]/submit
 * Submit draft listing for admin approval
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return apiError("Invalid listing ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    const supabase = await createServerSupabase();

    // Get the listing and verify it's in draft status
    const { data: listing, error: fetchError } = await supabase
      .from("listings")
      .select("id, name, status")
      .eq("id", listingId)
      .single();

    if (fetchError || !listing) {
      return apiError("Listing not found", 404);
    }

    if (listing.status === "published") {
      return apiError("Listing is already published", 400);
    }

    if (listing.status === "pending_approval") {
      return apiError("Listing is already pending approval", 400);
    }

    if (listing.status !== "draft") {
      return apiError(
        `Cannot submit listing with status: ${listing.status}`,
        400,
      );
    }

    // Check rate limit: max 3 listings per month per user
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { count: userListingCount } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId)
      .gte("created_at", oneMonthAgo.toISOString());

    if (userListingCount && userListingCount >= 3) {
      // Log security event for rate limit
      await supabase.from("security_events").insert({
        event_type: "rate_limit_exceeded",
        severity: "medium",
        user_id: userId,
        details: {
          reason: "User-based listing submission limit exceeded",
          count: userListingCount,
          limit: 3,
          period: "30 days",
        },
      });

      return apiError(
        "Rate limit exceeded. You can submit up to 3 listings per month.",
        429,
        "RATE_LIMIT_EXCEEDED",
        {
          limit: 3,
          period: "30 days",
          current: userListingCount,
        },
      );
    }

    // Update listing status to pending_approval
    const { error: updateError } = await supabase
      .from("listings")
      .update({
        status: "pending_approval",
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId);

    if (updateError) {
      throw new Error(`Failed to submit listing: ${updateError.message}`);
    }

    // TODO: Notify admins for review (implement when notification system is ready)
    // await notifyAdminsNewListing(listingId);

    return apiSuccess(
      { submitted: true, status: "pending_approval" },
      "Listing submitted for admin review. You will be notified once approved.",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
