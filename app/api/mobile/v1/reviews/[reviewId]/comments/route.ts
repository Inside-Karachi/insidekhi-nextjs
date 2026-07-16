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

/** Throws 404 unless the review exists and is approved (comments live on
 * approved reviews only). */
async function assertApprovedReview(
  supabase: MobileSupabase,
  reviewId: number,
): Promise<void> {
  const { data } = await supabase
    .from("reviews")
    .select("id, status")
    .eq("id", reviewId)
    .maybeSingle();
  if (!data || data.status !== "approved") {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }
}

/**
 * GET /api/mobile/v1/reviews/{reviewId}/comments?page=&limit=
 *
 * Paginated top-level approved comments for an approved review, each with an
 * approved-reply count. Pending comments are invisible to everyone (incl. the
 * author) until approved.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  const { user, supabase } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;
  await assertApprovedReview(supabase, reviewId);

  const { data, count, error } = await supabase
    .from("review_comments")
    .select(COMMENT_COLUMNS, { count: "exact" })
    .eq("review_id", reviewId)
    .is("parent_id", null)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .returns<CommentRowLike[]>()
    .range(offset, offset + limit - 1);
  if (error) {
    console.error("[mobile-api] comments query failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load comments.", 500);
  }

  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const replyCounts: Record<number, number> = {};
  if (ids.length > 0) {
    const { data: replies, error: replyErr } = await supabase
      .from("review_comments")
      .select("parent_id")
      .in("parent_id", ids)
      .eq("status", "approved");
    if (replyErr) {
      console.error("[mobile-api] reply-count query failed:", replyErr.message);
    }
    for (const r of replies ?? []) {
      if (r.parent_id != null)
        replyCounts[r.parent_id] = (replyCounts[r.parent_id] ?? 0) + 1;
    }
  }

  const comments = rows.map((r) =>
    toComment(r, currentUserId, replyCounts[r.id] ?? 0),
  );
  const total = count ?? 0;
  return ok(comments, {
    pagination: {
      total,
      page,
      limit,
      has_more: offset + comments.length < total,
    },
  });
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  parent_id: z.number().int().positive().optional(),
});

/**
 * POST /api/mobile/v1/reviews/{reviewId}/comments
 *
 * Create a comment (-> pending). An optional `parent_id` must reference an
 * approved, top-level comment on the same review (replies are single-level).
 * Owner-scoped insert via the caller's RLS client.
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user, supabase } = await requireMobileUser(request);

  const parsed = createCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MobileApiError(
      "validation_error",
      first?.message ?? "Invalid comment.",
      400,
      first?.path.join("."),
    );
  }
  const { content, parent_id } = parsed.data;

  await assertApprovedReview(supabase, reviewId);

  if (parent_id != null) {
    const { data: parent } = await supabase
      .from("review_comments")
      .select("id")
      .eq("id", parent_id)
      .eq("review_id", reviewId)
      .is("parent_id", null)
      .eq("status", "approved")
      .maybeSingle();
    if (!parent) {
      throw new MobileApiError(
        "not_found",
        "Parent comment not found.",
        404,
        "parent_id",
      );
    }
  }

  const { data: created, error } = await supabase
    .from("review_comments")
    .insert({
      review_id: reviewId,
      user_id: user.id,
      content,
      parent_id: parent_id ?? null,
      status: "pending",
    })
    .select(COMMENT_COLUMNS)
    .returns<CommentRowLike[]>()
    .single();
  if (error || !created) {
    console.error("[mobile-api] comment insert failed:", error?.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to create comment.",
      500,
    );
  }

  return ok(toComment(created, user.id, 0), undefined, { status: 201 });
});
