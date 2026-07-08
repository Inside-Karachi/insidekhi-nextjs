import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import type { MobileSupabase } from "@/lib/mobile/supabase";

export const dynamic = "force-dynamic";

/**
 * Authoritative helpful count: the number of `helpful_reviews` rows for the
 * review. We compute it here rather than reading `reviews.helpful_count` because
 * that denormalized column is maintained by a SECURITY INVOKER trigger whose
 * `UPDATE reviews` is filtered by RLS when the voter is not the review owner -
 * so it does not reliably reflect votes.
 */
async function helpfulCount(
  supabase: MobileSupabase,
  reviewId: number,
): Promise<number> {
  const { count, error } = await supabase
    .from("helpful_reviews")
    .select("review_id", { count: "exact", head: true })
    .eq("review_id", reviewId);
  if (error) {
    console.error("[mobile-api] helpful count failed:", error.message);
  }
  return count ?? 0;
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
  const { user, supabase } = await getOptionalMobileUser(request);

  // Non-approved reviews are invisible (like comments/threads) - 404 rather than
  // disclosing that a pending/rejected review exists.
  const { data: review } = await supabase
    .from("reviews")
    .select("id, status")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || review.status !== "approved") {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }

  let userVoted = false;
  if (user) {
    const { data: vote } = await supabase
      .from("helpful_reviews")
      .select("review_id")
      .eq("review_id", reviewId)
      .eq("user_id", user.id)
      .maybeSingle();
    userVoted = vote != null;
  }

  return ok({
    helpful_count: await helpfulCount(supabase, reviewId),
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
  const { user, supabase } = await requireMobileUser(request);

  const { data: review } = await supabase
    .from("reviews")
    .select("id, user_id, status")
    .eq("id", reviewId)
    .maybeSingle();
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

  const { data: existing } = await supabase
    .from("helpful_reviews")
    .select("review_id")
    .eq("review_id", reviewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    throw new MobileApiError(
      "already_voted",
      "You have already voted on this review.",
      400,
    );
  }

  const { error: insertError } = await supabase
    .from("helpful_reviews")
    .insert({ review_id: reviewId, user_id: user.id });
  if (insertError) {
    // Unique-PK violation = a concurrent vote landed first; treat as already voted
    // (the pre-check above is a fast path, the PK is the real guard).
    if (insertError.code === "23505") {
      throw new MobileApiError(
        "already_voted",
        "You have already voted on this review.",
        400,
      );
    }
    console.error("[mobile-api] helpful insert failed:", insertError.message);
    throw new MobileApiError("internal_error", "Failed to record vote.", 500);
  }

  return ok({
    helpful_count: await helpfulCount(supabase, reviewId),
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
  const { user, supabase } = await requireMobileUser(request);

  const { error: deleteError } = await supabase
    .from("helpful_reviews")
    .delete()
    .eq("review_id", reviewId)
    .eq("user_id", user.id);
  if (deleteError) {
    console.error("[mobile-api] helpful delete failed:", deleteError.message);
    throw new MobileApiError("internal_error", "Failed to remove vote.", 500);
  }

  return ok({
    helpful_count: await helpfulCount(supabase, reviewId),
    user_voted: false,
  });
});
