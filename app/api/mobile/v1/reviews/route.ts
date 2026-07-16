import { createServerSupabase } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  REVIEW_COLUMNS,
  toReview,
  type ReviewRowLike,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["lister", "admin", "super_admin"];

/**
 * GET /api/mobile/v1/reviews?listing_id=&page=&limit=
 *
 * Approved reviews for a listing, paginated, each with a `comment_count` of its
 * approved comments. Admins/listers see all statuses. Mirrors `app/api/reviews`
 * (GET), normalized into the mobile envelope; reviewer auth UUIDs are never
 * exposed (only `is_own` + author handle).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const listingId = parseInt(searchParams.get("listing_id") ?? "", 10);
  if (Number.isNaN(listingId)) {
    throw new MobileApiError(
      "validation_error",
      "listing_id is required.",
      400,
      "listing_id",
    );
  }
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  const { user, supabase } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  // Staff may see non-approved reviews; everyone else sees approved only.
  let isStaff = false;
  if (currentUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUserId)
      .maybeSingle();
    isStaff = profile?.role != null && STAFF_ROLES.includes(profile.role);
  }

  let query = supabase
    .from("reviews")
    .select(REVIEW_COLUMNS, { count: "exact" })
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  if (!isStaff) query = query.eq("status", "approved");

  const { data, count, error } = await query
    .range(offset, offset + limit - 1)
    .returns<ReviewRowLike[]>();
  if (error) {
    console.error("[mobile-api] reviews query failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load reviews.", 500);
  }

  const rows = data ?? [];
  const reviewIds = rows.map((r) => r.id);

  // Approved-comment counts for the returned reviews.
  const commentCounts: Record<number, number> = {};
  if (reviewIds.length > 0) {
    const { data: comments } = await supabase
      .from("review_comments")
      .select("review_id")
      .in("review_id", reviewIds)
      .eq("status", "approved");
    for (const c of comments ?? []) {
      commentCounts[c.review_id] = (commentCounts[c.review_id] ?? 0) + 1;
    }
  }

  const reviews = rows.map((r) => ({
    ...toReview(r, currentUserId),
    comment_count: commentCounts[r.id] ?? 0,
  }));

  return ok(reviews, {
    pagination: buildPaginationMeta(page, limit, count ?? 0),
  });
});

const createReviewSchema = z.object({
  listing_id: z.number().int().positive(),
  branch_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(500).trim(),
});

/**
 * POST /api/mobile/v1/reviews
 *
 * Create a review (-> `pending` moderation). Owner-scoped insert via the caller's
 * RLS client. Staff who manage the listing are blocked (`conflict_of_interest`,
 * 403). Mirrors `app/api/reviews` (POST). New reviews are invisible in lists
 * until approved - the app should show an optimistic "pending review" state.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);

  const parsed = createReviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MobileApiError(
      "validation_error",
      first?.message ?? "Invalid review.",
      400,
      first?.path.join("."),
    );
  }
  const { listing_id, branch_id, rating, comment } = parsed.data;

  // Listing must exist and be published.
  const { data: listing } = await supabase
    .from("listings_with_details")
    .select("id")
    .eq("id", listing_id)
    .eq("status", "published")
    .maybeSingle();
  if (!listing) {
    throw new MobileApiError(
      "not_found",
      "Listing not found or not available for reviews.",
      404,
    );
  }

  // Branch must belong to the listing.
  const { data: branch } = await supabase
    .from("listing_branches")
    .select("id")
    .eq("id", branch_id)
    .eq("listing_id", listing_id)
    .maybeSingle();
  if (!branch) {
    throw new MobileApiError(
      "not_found",
      "Branch not found for this listing.",
      404,
      "branch_id",
    );
  }

  // Staff cannot review listings they manage (conflict of interest).
  const { data: managesListing } = await supabase.rpc("user_manages_listing", {
    p_user_id: user.id,
    p_listing_id: listing_id,
  });
  if (managesListing === true) {
    throw new MobileApiError(
      "conflict_of_interest",
      "Staff members cannot review listings they manage.",
      403,
    );
  }

  // Auto-flag suspicious patterns (does not block submission).
  const { data: suspicious } = await supabase.rpc(
    "check_suspicious_review_pattern",
    { p_user_id: user.id, p_branch_id: branch_id },
  );
  const isFlagged =
    Array.isArray(suspicious) &&
    (suspicious[0] as { is_suspicious?: boolean } | undefined)
      ?.is_suspicious === true;

  const { data: created, error: insertError } = await supabase
    .from("reviews")
    .insert({
      listing_id,
      branch_id,
      user_id: user.id,
      rating,
      comment,
      status: "pending",
      is_flagged_suspicious: isFlagged,
    })
    .select(REVIEW_COLUMNS)
    .returns<ReviewRowLike[]>()
    .single();

  if (insertError || !created) {
    console.error("[mobile-api] review insert failed:", insertError?.message);
    throw new MobileApiError("internal_error", "Failed to create review.", 500);
  }

  return ok(
    {
      ...toReview(created, user.id),
      comment_count: 0,
    },
    undefined,
    { status: 201 },
  );
});
