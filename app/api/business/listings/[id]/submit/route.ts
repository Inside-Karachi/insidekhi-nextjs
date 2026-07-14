import { NextRequest } from "next/server";
import { query } from "@/lib/db";
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

    // Get the listing and verify it's in draft status
    const { rows: listingRows } = await query(
      `SELECT id, name, status FROM listings WHERE id = $1`,
      [listingId],
    );
    const listing = listingRows[0];

    if (!listing) {
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

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM listings WHERE owner_id = $1 AND created_at >= $2`,
      [userId, oneMonthAgo.toISOString()],
    );
    const userListingCount = parseInt(countRows[0].count, 10);

    if (userListingCount && userListingCount >= 3) {
      // Log security event for rate limit
      await query(
        `INSERT INTO security_events (event_type, severity, user_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          "rate_limit_exceeded",
          "medium",
          userId,
          JSON.stringify({
            reason: "User-based listing submission limit exceeded",
            count: userListingCount,
            limit: 3,
            period: "30 days",
          }),
        ],
      );

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
    try {
      await query(
        `UPDATE listings SET status = 'pending_approval', updated_at = $1 WHERE id = $2`,
        [new Date().toISOString(), listingId],
      );
    } catch (updateError) {
      throw new Error(
        `Failed to submit listing: ${updateError instanceof Error ? updateError.message : "Unknown error"}`,
      );
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
