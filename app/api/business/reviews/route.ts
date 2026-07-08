import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  verifyBusinessOwner,
  apiSuccess,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import type { PaginatedResponse } from "@/types/business-owner.types";
import type { BusinessReview } from "@/hooks/useBusinessReviews";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");
    const branchId = searchParams.get("branchId");
    const rating = searchParams.get("rating");
    const needsReply = searchParams.get("needsReply") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Get user's listings
    const { data: userListings, error: listingsError } = await supabase
      .from("listings")
      .select("id")
      .eq("owner_id", userId);

    if (listingsError) {
      throw new Error(`Failed to fetch listings: ${listingsError.message}`);
    }

    const userListingIds = userListings?.map((l) => l.id) || [];

    if (userListingIds.length === 0) {
      return apiSuccess<PaginatedResponse<BusinessReview>>({
        items: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false,
        },
      });
    }

    // Build query
    let query = supabase
      .from("reviews")
      .select(
        `
        id,
        listing_id,
        branch_id,
        rating,
        comment,
        created_at,
        user_id,
        profiles!reviews_user_id_fkey (
          full_name,
          avatar_url
        ),
        listings!reviews_listing_id_fkey (
          name
        ),
        listing_branches (
          branch_name
        ),
        review_comments!review_comments_review_id_fkey (
          id,
          content,
          created_at,
          edit_count,
          last_edited_at
        )
      `,
        { count: "exact" },
      )
      .in("listing_id", userListingIds)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    // Apply filters
    if (listingId) {
      query = query.eq("listing_id", parseInt(listingId));
    }
    if (branchId) {
      query = query.eq("branch_id", parseInt(branchId));
    }
    if (rating) {
      query = query.eq("rating", parseInt(rating));
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error: reviewsError, count } = await query;

    if (reviewsError) {
      throw new Error(`Failed to fetch reviews: ${reviewsError.message}`);
    }

    // Filter for needs reply if requested
    let filteredReviews = reviews || [];
    if (needsReply) {
      filteredReviews = filteredReviews.filter(
        (r) => !r.review_comments || r.review_comments.length === 0,
      );
    }

    const total = needsReply ? filteredReviews.length : count || 0;
    const totalPages = Math.ceil(total / limit);

    const formattedReviews: BusinessReview[] = filteredReviews.map((review) => {
      const replyComment =
        Array.isArray(review.review_comments) &&
        review.review_comments.length > 0
          ? review.review_comments[0]
          : null;

      const canEdit = replyComment
        ? (replyComment.edit_count || 0) < 3 &&
          new Date().getTime() - new Date(replyComment.created_at).getTime() <
            24 * 60 * 60 * 1000
        : false;

      return {
        id: review.id,
        listing_id: review.listing_id,
        listing_name: Array.isArray(review.listings)
          ? review.listings[0]?.name || ""
          : (review.listings as { name: string })?.name || "",
        branch_id: review.branch_id,
        branch_name:
          Array.isArray(review.listing_branches) &&
          review.listing_branches.length > 0
            ? review.listing_branches[0].branch_name
            : null,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        reviewer_name: Array.isArray(review.profiles)
          ? review.profiles[0]?.full_name || "Anonymous"
          : (review.profiles as { full_name: string | null })?.full_name ||
            "Anonymous",
        reviewer_avatar: Array.isArray(review.profiles)
          ? review.profiles[0]?.avatar_url || null
          : (review.profiles as { avatar_url: string | null })?.avatar_url ||
            null,
        reply: replyComment
          ? {
              id: replyComment.id,
              content: replyComment.content,
              created_at: replyComment.created_at,
              can_edit: canEdit,
            }
          : null,
      };
    });

    return apiSuccess<PaginatedResponse<BusinessReview>>({
      items: formattedReviews,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
