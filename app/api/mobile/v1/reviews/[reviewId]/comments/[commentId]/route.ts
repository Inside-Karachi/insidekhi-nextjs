import { createServerSupabase } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  COMMENT_COLUMNS,
  toComment,
  type CommentRowLike,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/reviews/{reviewId}/comments/{commentId}
 *
 * A comment thread: the approved top-level comment plus its approved replies.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user, supabase } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  const { data: comment } = await supabase
    .from("review_comments")
    .select(COMMENT_COLUMNS)
    .eq("id", commentId)
    .eq("review_id", reviewId)
    .is("parent_id", null)
    .eq("status", "approved")
    .returns<CommentRowLike[]>()
    .maybeSingle();
  if (!comment) {
    throw new MobileApiError("not_found", "Comment not found.", 404);
  }

  const { data: replyRows } = await supabase
    .from("review_comments")
    .select(COMMENT_COLUMNS)
    .eq("parent_id", commentId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .returns<CommentRowLike[]>();

  const replies = (replyRows ?? []).map((r) => toComment(r, currentUserId));

  return ok({
    comment: toComment(comment, currentUserId, replies.length),
    replies,
  });
});

const editCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

/** Loads a comment scoped to the review for ownership/status pre-checks. */
async function loadOwnPending(
  supabase: Awaited<ReturnType<typeof requireMobileUser>>["supabase"],
  reviewId: number,
  commentId: number,
  userId: string,
  verb: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("review_comments")
    .select("id, user_id, status")
    .eq("id", commentId)
    .eq("review_id", reviewId)
    .maybeSingle();
  if (!existing) {
    throw new MobileApiError("not_found", "Comment not found.", 404);
  }
  if (existing.user_id !== userId) {
    throw new MobileApiError(
      "forbidden",
      `You can only ${verb} your own comments.`,
      403,
    );
  }
  if (existing.status !== "pending") {
    throw new MobileApiError(
      "validation_error",
      `You can only ${verb} pending comments.`,
      400,
    );
  }
}

/**
 * PATCH /api/mobile/v1/reviews/{reviewId}/comments/{commentId}
 *
 * Edit your own still-pending comment's content. Owner + pending only - the
 * guards are also folded into the UPDATE so the invariant holds under races.
 */
export const PATCH = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user, supabase } = await requireMobileUser(request);

  const parsed = editCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "Invalid content.",
      400,
      "content",
    );
  }

  await loadOwnPending(supabase, reviewId, commentId, user.id, "edit");

  const { data: updated, error } = await supabase
    .from("review_comments")
    .update({ content: parsed.data.content })
    .eq("id", commentId)
    .eq("review_id", reviewId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select(COMMENT_COLUMNS)
    .returns<CommentRowLike[]>()
    .maybeSingle();
  if (error) {
    console.error("[mobile-api] comment edit failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to update comment.",
      500,
    );
  }
  if (!updated) {
    // Pre-check passed but the row changed (e.g. moderated) before the write.
    throw new MobileApiError(
      "conflict",
      "Comment can no longer be edited.",
      409,
    );
  }

  return ok(toComment(updated, user.id));
});

/**
 * DELETE /api/mobile/v1/reviews/{reviewId}/comments/{commentId}
 *
 * Delete your own still-pending comment (replies cascade). Owner + pending only,
 * enforced atomically in the DELETE.
 */
export const DELETE = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user, supabase } = await requireMobileUser(request);

  await loadOwnPending(supabase, reviewId, commentId, user.id, "delete");

  const { data: deleted, error } = await supabase
    .from("review_comments")
    .delete()
    .eq("id", commentId)
    .eq("review_id", reviewId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id");
  if (error) {
    console.error("[mobile-api] comment delete failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to delete comment.",
      500,
    );
  }
  if (!deleted || deleted.length === 0) {
    throw new MobileApiError(
      "conflict",
      "Comment can no longer be deleted.",
      409,
    );
  }

  return ok({ deleted: true });
});
