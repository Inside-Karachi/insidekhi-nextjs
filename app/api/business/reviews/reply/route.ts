import { NextRequest } from "next/server";
import { query } from "@/lib/db";
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
    const { rows: reviewRows } = await query(
      `SELECT r.id, r.listing_id, l.owner_id
       FROM reviews r
       JOIN listings l ON l.id = r.listing_id
       WHERE r.id = $1`,
      [reviewId],
    );
    const review = reviewRows[0];

    if (!review) {
      return apiError("Review not found", 404);
    }

    if (review.owner_id !== userId) {
      return apiError("You do not own this listing", 403);
    }

    // Check if already replied
    const { rows: existingReplyRows } = await query(
      `SELECT id FROM review_comments WHERE review_id = $1 AND user_id = $2`,
      [reviewId, userId],
    );

    if (existingReplyRows.length > 0) {
      return apiError("You have already replied to this review", 400);
    }

    // Create the reply with pending status for admin moderation
    let comment;
    try {
      const { rows: insertedRows } = await query(
        `INSERT INTO review_comments (review_id, user_id, content, status, edit_count)
         VALUES ($1, $2, $3, 'pending', 0)
         RETURNING *`,
        [reviewId, userId, content],
      );
      comment = insertedRows[0];
    } catch (commentError) {
      throw new Error(
        `Failed to create reply: ${commentError instanceof Error ? commentError.message : "Unknown error"}`,
      );
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
