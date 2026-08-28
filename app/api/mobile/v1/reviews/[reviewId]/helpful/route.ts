import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { notifyReviewHelpful } from "@/lib/reviews/notifications";

export const dynamic = "force-dynamic";

/**
 * Authoritative helpful count: the number of `helpful_reviews` rows for the
 * review. We compute it here rather than reading `reviews.helpful_count`
 * because that denormalized column was maintained by a SECURITY INVOKER
 * trigger scoped to `auth.uid()`, which never fires over a direct pg
 * connection - so it no longer reflects votes.
 */
async function helpfulCount(reviewId: number): Promise<number> {
  const { rows } = await query(
    `SELECT COUNT(*) FROM helpful_reviews WHERE review_id = $1`,
    [reviewId],
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * GET /api/mobile/v1/reviews/{reviewId}/helpful
 *
 * Returns the helpful-vote count and (when authenticated) whether the caller has
 * voted.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await getOptionalMobileUser(request);

  // Non-approved reviews are invisible (like comments/threads) - 404 rather than
  // disclosing that a pending/rejected review exists.
  const { rows: reviewRows } = await query(
    `SELECT id, status FROM reviews WHERE id = $1`,
    [reviewId],
  );
  const review = reviewRows[0];
  if (!review || review.status !== "approved") {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }

  let userVoted = false;
  if (user) {
    const { rows: voteRows } = await query(
      `SELECT 1 FROM helpful_reviews WHERE review_id = $1 AND user_id = $2`,
      [reviewId, user.id],
    );
    userVoted = voteRows.length > 0;
  }

  return ok({
    helpful_count: await helpfulCount(reviewId),
    user_voted: userVoted,
  });
});

/**
 * POST /api/mobile/v1/reviews/{reviewId}/helpful
 *
 * Records a helpful vote. Cannot vote on an unapproved review, your own review,
 * or twice.
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await requireMobileUser(request);

  const { rows: reviewRows } = await query(
    `SELECT id, user_id, listing_id, status FROM reviews WHERE id = $1`,
    [reviewId],
  );
  const review = reviewRows[0];
  if (!review) {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }
  if (review.status !== "approved") {
    throw new MobileApiError(
      "review_not_approved",
      "You can only vote on approved reviews.",
      400,
    );
  }
  if (review.user_id === user.id) {
    throw new MobileApiError(
      "cannot_vote_own_review",
      "You cannot vote on your own review.",
      400,
    );
  }

  const { rows: existingRows } = await query(
    `SELECT 1 FROM helpful_reviews WHERE review_id = $1 AND user_id = $2`,
    [reviewId, user.id],
  );
  if (existingRows.length > 0) {
    throw new MobileApiError(
      "already_voted",
      "You have already voted on this review.",
      400,
    );
  }

  try {
    await query(
      `INSERT INTO helpful_reviews (review_id, user_id) VALUES ($1, $2)`,
      [reviewId, user.id],
    );
  } catch (insertError) {
    const pgError = insertError as { code?: string };
    // Unique-PK violation = a concurrent vote landed first; treat as already voted
    // (the pre-check above is a fast path, the PK is the real guard).
    if (pgError.code === "23505") {
      throw new MobileApiError(
        "already_voted",
        "You have already voted on this review.",
        400,
      );
    }
    console.error("[mobile-api] helpful insert failed:", insertError);
    throw new MobileApiError("internal_error", "Failed to record vote.", 500);
  }

  const newCount = await helpfulCount(reviewId);

  try {
    await notifyReviewHelpful({
      review: {
        reviewId,
        userId: review.user_id,
        listingId: review.listing_id,
      },
      helpfulCount: newCount,
    });
  } catch (notifyError) {
    console.error("[mobile-api] helpful-vote notification failed:", notifyError);
  }

  return ok({
    helpful_count: newCount,
    user_voted: true,
  });
});

/**
 * DELETE /api/mobile/v1/reviews/{reviewId}/helpful
 *
 * Removes the caller's helpful vote (idempotent).
 */
export const DELETE = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await requireMobileUser(request);

  try {
    await query(
      `DELETE FROM helpful_reviews WHERE review_id = $1 AND user_id = $2`,
      [reviewId, user.id],
    );
  } catch (error) {
    console.error("[mobile-api] helpful delete failed:", error);
    throw new MobileApiError("internal_error", "Failed to remove vote.", 500);
  }

  return ok({
    helpful_count: await helpfulCount(reviewId),
    user_voted: false,
  });
});
