import { query } from "@/lib/db";
import {
  createNotification,
  refreshDedupedNotification,
} from "@/lib/notifications/service";

interface ReviewContext {
  reviewId: number;
  userId: string;
  listingId: number;
}

async function loadListingContext(listingId: number) {
  const { rows } = await query(
    `SELECT name, slug FROM public.listings WHERE id = $1 LIMIT 1`,
    [listingId]
  );
  return rows[0] as { name: string; slug: string } | undefined;
}

/**
 * "A business/organizer replied to your review" - fired once a reply
 * (review_comments row) clears moderation and becomes visible, not at
 * submission time, since the content isn't public until then.
 */
export async function notifyReviewReply(params: {
  review: ReviewContext;
  commentId: number;
  replySnippet: string;
}): Promise<void> {
  const listing = await loadListingContext(params.review.listingId);
  const listingName = listing?.name ?? "a business";

  try {
    await createNotification({
      recipientId: params.review.userId,
      roleScope: "public_user",
      categorySlug: "public_comment_outcome",
      title: `💬 ${listingName} replied to your review`,
      body: params.replySnippet,
      priority: "high",
      ctaLabel: "View reply",
      ctaUrl: listing?.slug ? `/listing/${listing.slug}` : undefined,
      channelOverrides: { push: true },
      metadata: {
        review_id: params.review.reviewId,
        comment_id: params.commentId,
        listing_id: params.review.listingId,
      },
    });
  } catch (error) {
    console.error("Failed to notify reviewer of business reply:", error);
  }
}

/**
 * "Someone found your review helpful" - one running notification per review
 * rather than one per vote, so a popular review doesn't spam its author.
 * Subsequent votes refresh the existing row's count instead of inserting.
 */
export async function notifyReviewHelpful(params: {
  review: ReviewContext;
  helpfulCount: number;
}): Promise<void> {
  const dedupeKey = `review-helpful-${params.review.reviewId}`;
  const title =
    params.helpfulCount === 1
      ? "❤️ Someone found your review helpful"
      : `❤️ ${params.helpfulCount} people found your review helpful`;
  const body = "Tap to see your review.";

  try {
    const result = await createNotification({
      recipientId: params.review.userId,
      roleScope: "public_user",
      categorySlug: "public_review_helpful",
      title,
      body,
      priority: "normal",
      ctaLabel: "View review",
      dedupeKey,
      metadata: {
        review_id: params.review.reviewId,
        helpful_count: params.helpfulCount,
      },
    });

    if (result.deduped) {
      await refreshDedupedNotification(params.review.userId, dedupeKey, {
        title,
        body,
        metadata: { review_id: params.review.reviewId, helpful_count: params.helpfulCount },
      });
    }
  } catch (error) {
    console.error("Failed to notify reviewer of helpful vote:", error);
  }
}

/**
 * "Your review is live" / "Your review has been removed" - fired from
 * moderation. Shares one dedupe key across approve/reject so a review that
 * flips status later still lands as a single, updated notification.
 */
export async function notifyReviewStatus(params: {
  review: ReviewContext;
  status: "approved" | "rejected";
}): Promise<void> {
  const isApproved = params.status === "approved";
  const dedupeKey = `review-status-${params.review.reviewId}`;
  const title = isApproved ? "✓ Your review is live" : "Your review has been removed";
  const body = isApproved
    ? "Your review is now visible to everyone."
    : "Your review didn't meet our community guidelines and has been taken down.";
  const metadata = { review_id: params.review.reviewId, status: params.status };

  try {
    const result = await createNotification({
      recipientId: params.review.userId,
      roleScope: "public_user",
      categorySlug: "public_review_outcome",
      title,
      body,
      priority: isApproved ? "normal" : "high",
      ctaLabel: "View review",
      channelOverrides: isApproved ? undefined : { push: true },
      dedupeKey,
      metadata,
    });

    // The key is shared across approve/reject so a status flip (e.g. a
    // rejected review later reinstated) updates the one notification in
    // place instead of being silently swallowed by dedup.
    if (result.deduped) {
      await refreshDedupedNotification(params.review.userId, dedupeKey, {
        title,
        body,
        metadata,
      });
    }
  } catch (error) {
    console.error("Failed to notify reviewer of moderation outcome:", error);
  }
}
