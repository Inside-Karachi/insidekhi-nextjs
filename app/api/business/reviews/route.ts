import { NextRequest } from "next/server";
import { query } from "@/lib/db";
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

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");
    const branchId = searchParams.get("branchId");
    const rating = searchParams.get("rating");
    const needsReply = searchParams.get("needsReply") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Get user's listings
    let userListings;
    try {
      const result = await query(
        `SELECT id FROM listings WHERE owner_id = $1`,
        [userId],
      );
      userListings = result.rows;
    } catch (listingsError) {
      throw new Error(
        `Failed to fetch listings: ${listingsError instanceof Error ? listingsError.message : "Unknown error"}`,
      );
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

    // Build filters
    const whereParams: unknown[] = [userListingIds];
    let whereSql = "listing_id = ANY($1::int[]) AND status = 'approved'";
    if (listingId) {
      whereParams.push(parseInt(listingId));
      whereSql += ` AND listing_id = $${whereParams.length}`;
    }
    if (branchId) {
      whereParams.push(parseInt(branchId));
      whereSql += ` AND branch_id = $${whereParams.length}`;
    }
    if (rating) {
      whereParams.push(parseInt(rating));
      whereSql += ` AND rating = $${whereParams.length}`;
    }

    const offset = (page - 1) * limit;

    let reviews, count;
    try {
      const countResult = await query(
        `SELECT COUNT(*) FROM reviews WHERE ${whereSql}`,
        whereParams,
      );
      count = parseInt(countResult.rows[0].count, 10);

      const listParams = [...whereParams, limit, offset];
      const reviewsResult = await query(
        `SELECT id, listing_id, branch_id, rating, comment, created_at, user_id
         FROM reviews
         WHERE ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      );
      reviews = reviewsResult.rows;
    } catch (reviewsError) {
      throw new Error(
        `Failed to fetch reviews: ${reviewsError instanceof Error ? reviewsError.message : "Unknown error"}`,
      );
    }

    // Fetch related data in bulk, then stitch together
    const reviewIds = reviews.map((r) => r.id);
    const userIds = [...new Set(reviews.map((r) => r.user_id))];
    const listingIds = [...new Set(reviews.map((r) => r.listing_id))];
    const branchIds = [
      ...new Set(reviews.map((r) => r.branch_id).filter((id) => id != null)),
    ];

    const [profilesResult, listingsResult, branchesResult, commentsResult] =
      await Promise.all([
        userIds.length > 0
          ? query(
              `SELECT id, full_name, avatar_url FROM profiles WHERE id = ANY($1::uuid[])`,
              [userIds],
            )
          : { rows: [] },
        listingIds.length > 0
          ? query(`SELECT id, name FROM listings WHERE id = ANY($1::int[])`, [
              listingIds,
            ])
          : { rows: [] },
        branchIds.length > 0
          ? query(
              `SELECT id, branch_name FROM listing_branches WHERE id = ANY($1::int[])`,
              [branchIds],
            )
          : { rows: [] },
        reviewIds.length > 0
          ? query(
              `SELECT id, review_id, content, created_at, edit_count, last_edited_at
               FROM review_comments WHERE review_id = ANY($1::int[])`,
              [reviewIds],
            )
          : { rows: [] },
      ]);

    const profileById = new Map(profilesResult.rows.map((p) => [p.id, p]));
    const listingNameById = new Map(
      listingsResult.rows.map((l) => [l.id, l.name]),
    );
    const branchNameById = new Map(
      branchesResult.rows.map((b) => [b.id, b.branch_name]),
    );
    const commentsByReviewId = new Map<number, typeof commentsResult.rows>();
    for (const comment of commentsResult.rows) {
      const existing = commentsByReviewId.get(comment.review_id) || [];
      existing.push(comment);
      commentsByReviewId.set(comment.review_id, existing);
    }

    // Filter for needs reply if requested
    let filteredReviews = reviews;
    if (needsReply) {
      filteredReviews = filteredReviews.filter((r) => {
        const comments = commentsByReviewId.get(r.id);
        return !comments || comments.length === 0;
      });
    }

    const total = needsReply ? filteredReviews.length : count || 0;
    const totalPages = Math.ceil(total / limit);

    const formattedReviews: BusinessReview[] = filteredReviews.map((review) => {
      const reviewComments = commentsByReviewId.get(review.id);
      const replyComment =
        reviewComments && reviewComments.length > 0 ? reviewComments[0] : null;

      const canEdit = replyComment
        ? (replyComment.edit_count || 0) < 3 &&
          new Date().getTime() - new Date(replyComment.created_at).getTime() <
            24 * 60 * 60 * 1000
        : false;

      const profile = profileById.get(review.user_id);

      return {
        id: review.id,
        listing_id: review.listing_id,
        listing_name: listingNameById.get(review.listing_id) || "",
        branch_id: review.branch_id,
        branch_name:
          review.branch_id != null
            ? branchNameById.get(review.branch_id) || null
            : null,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        reviewer_name: profile?.full_name || "Anonymous",
        reviewer_avatar: profile?.avatar_url || null,
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
