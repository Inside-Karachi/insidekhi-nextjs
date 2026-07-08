import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import {
  applyLeaveReviewXpForModeration,
  leaveReviewListingKey,
} from "@/lib/reviews/moderation-xp";

const ROUTE = "/api/admin/reviews/bulk-moderate";
const MAX_BULK_REVIEWS = 100;
const MODERATION_STATUSES = new Set(["approved", "rejected", "pending"]);

function parseReviewIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed = raw
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  return [...new Set(parsed)];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    if (
      profile.role !== "admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "lister"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin or lister access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { reviewIds, status, reason } = body;

    const parsedIds = parseReviewIds(reviewIds);
    if (parsedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Valid review IDs are required" },
        { status: 400 },
      );
    }

    if (parsedIds.length > MAX_BULK_REVIEWS) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot moderate more than ${MAX_BULK_REVIEWS} reviews at once`,
        },
        { status: 400 },
      );
    }

    if (!status || !MODERATION_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    const { data: reviews, error: fetchError } = await adminSupabase
      .from("reviews")
      .select("id, listing_id, user_id")
      .in("id", parsedIds);

    if (fetchError) {
      captureRouteError(fetchError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { success: false, error: "Failed to load reviews" },
        { status: 500 },
      );
    }

    if (!reviews?.length) {
      return NextResponse.json(
        { success: false, error: "No matching reviews found" },
        { status: 404 },
      );
    }

    const moderatedAt = new Date().toISOString();
    const idsToUpdate = reviews.map((r) => r.id);

    const { data: updatedRows, error: reviewError } = await adminSupabase
      .from("reviews")
      .update({
        status,
        moderated_by: user.id,
        moderated_at: moderatedAt,
      })
      .in("id", idsToUpdate)
      .select("id");

    if (reviewError) {
      console.error("Bulk database update error:", reviewError);
      captureRouteError(reviewError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { success: false, error: "Failed to update review statuses" },
        { status: 500 },
      );
    }

    const updatedCount = updatedRows?.length ?? 0;
    const awardedListingKeys = new Set<string>();

    for (const review of reviews) {
      if (status === "approved") {
        const key = leaveReviewListingKey(review.user_id, review.listing_id);
        if (awardedListingKeys.has(key)) {
          continue;
        }
        awardedListingKeys.add(key);
      }

      await applyLeaveReviewXpForModeration(
        adminSupabase,
        {
          reviewId: review.id,
          userId: review.user_id,
          listingId: review.listing_id,
        },
        status,
      );
    }

    return NextResponse.json({
      success: true,
      message: `${updatedCount} reviews ${status} successfully`,
      data: {
        review_ids: idsToUpdate,
        status,
        reason,
        moderated_by: user.id,
        moderated_at: moderatedAt,
        count: updatedCount,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/reviews/bulk-moderate error:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Failed to moderate reviews" },
      { status: 500 },
    );
  }
}
