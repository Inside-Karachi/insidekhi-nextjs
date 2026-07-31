import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  verifyWriter,
  verifyPostOwnership,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/blogs/api-utils";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/writer/blogs/[id]/submit
 * Submit a draft/rejected post for admin approval.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      return apiError("Invalid post ID", 400);
    }

    const userId = await verifyWriter();
    await verifyPostOwnership(userId, postId);

    const { rows: postRows } = await query(
      `SELECT id, title, status FROM posts WHERE id = $1`,
      [postId],
    );
    const post = postRows[0];
    if (!post) {
      return apiError("Post not found", 404);
    }

    if (post.status === "published") {
      return apiError("Post is already published", 400);
    }
    if (post.status === "pending_approval") {
      return apiError("Post is already pending approval", 400);
    }
    if (!["draft", "rejected"].includes(post.status)) {
      return apiError(`Cannot submit post with status: ${post.status}`, 400);
    }

    // Rate limit: max 3 submissions per 30 days per writer, mirroring
    // app/api/business/listings/[id]/submit.
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM posts WHERE author_id = $1 AND submitted_at >= $2`,
      [userId, oneMonthAgo.toISOString()],
    );
    const submissionCount = parseInt(countRows[0].count, 10);

    if (submissionCount && submissionCount >= 3) {
      await query(
        `INSERT INTO security_events (event_type, severity, user_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          "rate_limit_exceeded",
          "medium",
          userId,
          JSON.stringify({
            reason: "Writer blog submission limit exceeded",
            count: submissionCount,
            limit: 3,
            period: "30 days",
          }),
        ],
      );

      return apiError(
        "Rate limit exceeded. You can submit up to 3 posts per month.",
        429,
        "RATE_LIMIT_EXCEEDED",
        { limit: 3, period: "30 days", current: submissionCount },
      );
    }

    const now = new Date().toISOString();
    await query(
      `UPDATE posts SET status = 'pending_approval', submitted_at = $1, updated_at = $1 WHERE id = $2`,
      [now, postId],
    );

    return apiSuccess(
      { submitted: true, status: "pending_approval" },
      "Post submitted for admin review. You will be notified once approved.",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
