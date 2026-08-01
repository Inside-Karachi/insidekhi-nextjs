import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  verifyBusinessOwner,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import { z } from "zod";
import {
  createNotification,
  resolveCategorySlugForRole,
  dispatchEmailOutboxBatch,
} from "@/lib/notifications";
import type { NotificationUserRole } from "@/types/notifications.types";

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
      `SELECT r.id, r.listing_id, l.owner_id, l.name AS listing_name
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

    // Notify listers/admins that a reply needs moderation.
    try {
      const { rows: recipients } = await query(
        `SELECT id, role FROM profiles WHERE role::text = ANY($1::text[])`,
        [["lister", "admin", "super_admin"]],
      );

      if (recipients.length) {
        const categoryCache = new Map<NotificationUserRole, string>();
        await Promise.allSettled(
          recipients.map(async (recipient) => {
            try {
              const role = recipient.role as NotificationUserRole;
              if (!categoryCache.has(role)) {
                categoryCache.set(role, await resolveCategorySlugForRole(role));
              }
              await createNotification({
                recipientId: recipient.id,
                roleScope: role,
                categorySlug: categoryCache.get(role)!,
                title: "New review reply pending moderation",
                body: `A business owner replied to a review on "${review.listing_name}".`,
                priority: "normal",
                ctaLabel: "Review Reply",
                ctaUrl: "/admin/reviews",
                metadata: {
                  comment_id: comment.id,
                  review_id: reviewId,
                  listing_id: review.listing_id,
                  listing_name: review.listing_name,
                },
              });
            } catch (notificationError) {
              console.error(
                "Failed to queue review reply notification:",
                notificationError,
              );
            }
          }),
        );

        try {
          await dispatchEmailOutboxBatch({});
        } catch (dispatchError) {
          console.error(
            "Failed to dispatch review reply notifications:",
            dispatchError,
          );
        }
      }
    } catch (notifyError) {
      console.error("Failed to notify staff of review reply:", notifyError);
    }

    return apiSuccess({
      commentId: comment.id,
      status: "pending",
      message: "Reply submitted for moderation",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
