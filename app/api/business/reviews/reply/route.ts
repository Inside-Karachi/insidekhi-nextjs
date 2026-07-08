import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  verifyBusinessOwner,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const replySchema = z.object({
  reviewId: z.number().positive(),
  content: z.string().min(10).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();

    const body = await request.json();
    const validation = replySchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Invalid input: " + validation.error.errors[0].message,
        400,
      );
    }

    const { reviewId, content } = validation.data;

    // Get the review and verify ownership
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("id, listing_id, listings!reviews_listing_id_fkey(owner_id)")
      .eq("id", reviewId)
      .single();

    if (reviewError || !review) {
      return apiError("Review not found", 404);
    }

    const listing = Array.isArray(review.listings)
      ? review.listings[0]
      : (review.listings as { owner_id: string } | null);

    if (!listing || listing.owner_id !== userId) {
      return apiError("You do not own this listing", 403);
    }

    // Check if already replied
    const { data: existingReply } = await supabase
      .from("review_comments")
      .select("id")
      .eq("review_id", reviewId)
      .eq("user_id", userId)
      .single();

    if (existingReply) {
      return apiError("You have already replied to this review", 400);
    }

    // Create the reply with pending status for admin moderation
    const { data: comment, error: commentError } = await supabase
      .from("review_comments")
      .insert({
        review_id: reviewId,
        user_id: userId,
        content,
        status: "pending",
        edit_count: 0,
      })
      .select()
      .single();

    if (commentError) {
      throw new Error(`Failed to create reply: ${commentError.message}`);
    }

    // TODO: Notify admins for moderation (implement when notification system is ready)

    return apiSuccess({
      commentId: comment.id,
      status: "pending",
      message: "Reply submitted for moderation",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
