import { createServerSupabase } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination } from "@/lib/mobile/pagination";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  COMMENT_COLUMNS,
  toComment,
  type CommentRowLike,
} from "@/lib/mobile/mappers";
import type { MobileSupabase } from "@/lib/mobile/supabase";

export const dynamic = "force-dynamic";

/** The parent must be an approved, top-level comment on this review (replies are
 * single-level - you cannot reply to a reply). Throws 404 otherwise. */
async function assertApprovedParent(
  supabase: MobileSupabase,
  reviewId: number,
  commentId: number,
): Promise<void> {
  const { data } = await supabase
    .from("review_comments")
    .select("id")
    .eq("id", commentId)
    .eq("review_id", reviewId)
    .is("parent_id", null)
    .eq("status", "approved")
    .maybeSingle();
  if (!data) {
    throw new MobileApiError("not_found", "Parent comment not found.", 404);
  }
}

/**
 * GET /api/mobile/v1/reviews/{reviewId}/comments/{commentId}/replies
 *
 * Paginated approved replies to a top-level comment.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  const { user, supabase } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;
  await assertApprovedParent(supabase, reviewId, commentId);

  const { data, count, error } = await supabase
    .from("review_comments")
    .select(COMMENT_COLUMNS, { count: "exact" })
    .eq("parent_id", commentId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .returns<CommentRowLike[]>()
    .range(offset, offset + limit - 1);
  if (error) {
    console.error("[mobile-api] replies query failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load replies.", 500);
  }

  const replies = (data ?? []).map((r) => toComment(r, currentUserId));
  const total = count ?? 0;
  return ok(replies, {
    pagination: {
      total,
      page,
      limit,
      has_more: offset + replies.length < total,
    },
  });
});

const createReplySchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

/**
 * POST /api/mobile/v1/reviews/{reviewId}/comments/{commentId}/replies
 *
 * Reply to a top-level approved comment (-> pending).
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user, supabase } = await requireMobileUser(request);

  const parsed = createReplySchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "Invalid reply.",
      400,
      "content",
    );
  }

  await assertApprovedParent(supabase, reviewId, commentId);

  const { data: created, error } = await supabase
    .from("review_comments")
    .insert({
      review_id: reviewId,
      user_id: user.id,
      parent_id: commentId,
      content: parsed.data.content,
      status: "pending",
    })
    .select(COMMENT_COLUMNS)
    .returns<CommentRowLike[]>()
    .single();
  if (error || !created) {
    console.error("[mobile-api] reply insert failed:", error?.message);
    throw new MobileApiError("internal_error", "Failed to create reply.", 500);
  }

  return ok(toComment(created, user.id, 0), undefined, { status: 201 });
});
