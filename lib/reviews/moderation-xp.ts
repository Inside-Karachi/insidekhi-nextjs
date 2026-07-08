import type { SupabaseClient } from "@supabase/supabase-js";
import { awardXP } from "@/lib/gamification";
import type { Database } from "@/types/supabase";

export type ReviewModerationTarget = {
  reviewId: number;
  userId: string;
  listingId: number;
};

const LEAVE_REVIEW = "leave_review";

async function hasOtherApprovedReviewForListing(
  adminSupabase: SupabaseClient<Database>,
  review: ReviewModerationTarget,
): Promise<boolean> {
  const { data } = await adminSupabase
    .from("reviews")
    .select("id")
    .eq("user_id", review.userId)
    .eq("listing_id", review.listingId)
    .eq("status", "approved")
    .neq("id", review.reviewId)
    .limit(1)
    .maybeSingle();

  return !!data;
}

async function deleteLeaveReviewXpLog(
  adminSupabase: SupabaseClient<Database>,
  userId: string,
  listingId: number,
): Promise<void> {
  const { error: deleteError } = await adminSupabase
    .from("points_log")
    .delete()
    .eq("user_id", userId)
    .eq("reason", LEAVE_REVIEW)
    .eq("related_id", listingId);

  if (deleteError) {
    console.error(
      `[REVIEW XP] Failed to cleanup leave_review XP (user=${userId}, listing=${listingId}):`,
      deleteError,
    );
  }
}

/** Remove listing-level leave_review XP when no other approved review remains. */
export async function cleanupLeaveReviewXpOnReject(
  adminSupabase: SupabaseClient<Database>,
  review: ReviewModerationTarget,
): Promise<void> {
  if (await hasOtherApprovedReviewForListing(adminSupabase, review)) {
    return;
  }
  await deleteLeaveReviewXpLog(adminSupabase, review.userId, review.listingId);
}

/** Same guard as reject - used when a review row is deleted. */
export async function cleanupLeaveReviewXpOnDelete(
  adminSupabase: SupabaseClient<Database>,
  review: ReviewModerationTarget,
): Promise<void> {
  await cleanupLeaveReviewXpOnReject(adminSupabase, review);
}

/** Award leave_review XP once per user + listing (per_target). */
export async function awardLeaveReviewXpOnApprove(
  adminSupabase: SupabaseClient<Database>,
  review: ReviewModerationTarget,
): Promise<void> {
  const { data: existingXP } = await adminSupabase
    .from("points_log")
    .select("id")
    .eq("user_id", review.userId)
    .eq("reason", LEAVE_REVIEW)
    .eq("related_id", review.listingId)
    .maybeSingle();

  if (existingXP) {
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
  adminSupabase: SupabaseClient<Database>,
  review: ReviewModerationTarget,
  status: string,
): Promise<void> {
  if (status === "rejected") {
    await cleanupLeaveReviewXpOnReject(adminSupabase, review);
  } else if (status === "approved") {
    await awardLeaveReviewXpOnApprove(adminSupabase, review);
  }
}

/** Dedupe key for bulk approve - one award per user + listing per batch. */
export function leaveReviewListingKey(userId: string, listingId: number): string {
  return `${userId}:${listingId}`;
}
