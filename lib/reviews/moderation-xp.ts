import { query } from "@/lib/db";
import { awardXP } from "@/lib/gamification";

export type ReviewModerationTarget = {
  reviewId: number;
  userId: string;
  listingId: number;
};

const LEAVE_REVIEW = "leave_review";

async function hasOtherApprovedReviewForListing(
  review: ReviewModerationTarget,
): Promise<boolean> {
  const { rows } = await query(
    `SELECT id FROM public.reviews
     WHERE user_id = $1 AND listing_id = $2 AND status = 'approved' AND id != $3
     LIMIT 1`,
    [review.userId, review.listingId, review.reviewId],
  );

  return rows.length > 0;
}

async function deleteLeaveReviewXpLog(
  userId: string,
  listingId: number,
): Promise<void> {
  try {
    await query(
      `DELETE FROM public.points_log
       WHERE user_id = $1 AND reason = $2 AND related_id = $3`,
      [userId, LEAVE_REVIEW, listingId],
    );
  } catch (deleteError) {
    console.error(
      `[REVIEW XP] Failed to cleanup leave_review XP (user=${userId}, listing=${listingId}):`,
      deleteError,
    );
  }
}

/** Remove listing-level leave_review XP when no other approved review remains. */
export async function cleanupLeaveReviewXpOnReject(
  review: ReviewModerationTarget,
): Promise<void> {
  if (await hasOtherApprovedReviewForListing(review)) {
    return;
  }
  await deleteLeaveReviewXpLog(review.userId, review.listingId);
}

/** Same guard as reject - used when a review row is deleted. */
export async function cleanupLeaveReviewXpOnDelete(
  review: ReviewModerationTarget,
): Promise<void> {
  await cleanupLeaveReviewXpOnReject(review);
}

/** Award leave_review XP once per user + listing (per_target). */
export async function awardLeaveReviewXpOnApprove(
  review: ReviewModerationTarget,
): Promise<void> {
  const { rows: existingXP } = await query(
    `SELECT id FROM public.points_log
     WHERE user_id = $1 AND reason = $2 AND related_id = $3
     LIMIT 1`,
    [review.userId, LEAVE_REVIEW, review.listingId],
  );

  if (existingXP.length > 0) {
    return;
  }

  const xpResult = await awardXP(
    review.userId,
    LEAVE_REVIEW,
    review.listingId,
  );

  if ("error" in xpResult) {
    console.error(
      `[REVIEW XP] Failed to award XP for review ${review.reviewId}:`,
      xpResult.error,
      xpResult.details,
    );
  }
}

export async function applyLeaveReviewXpForModeration(
  review: ReviewModerationTarget,
  status: string,
): Promise<void> {
  if (status === "rejected") {
    await cleanupLeaveReviewXpOnReject(review);
  } else if (status === "approved") {
    await awardLeaveReviewXpOnApprove(review);
  }
}

/** Dedupe key for bulk approve - one award per user + listing per batch. */
export function leaveReviewListingKey(userId: string, listingId: number): string {
  return `${userId}:${listingId}`;
}
