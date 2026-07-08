import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { applyLeaveReviewXpForModeration } from "@/lib/reviews/moderation-xp";

const ROUTE = "/api/admin/reviews/[id]/moderate";

const MODERATION_STATUSES = new Set(["approved", "rejected", "pending"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const reviewId = parseInt(id, 10);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { status, reason } = body;

    if (!status || !MODERATION_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    const { data: reviewData, error: reviewFetchError } = await adminSupabase
      .from("reviews")
      .select("listing_id, user_id")
      .eq("id", reviewId)
      .single();

    if (reviewFetchError || !reviewData) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 },
      );
    }

    const { error: reviewError } = await adminSupabase
      .from("reviews")
      .update({
        status,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (reviewError) {
      console.error("Database update error:", reviewError);
      captureRouteError(reviewError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { success: false, error: "Failed to update review status" },
        { status: 500 },
      );
    }

    await applyLeaveReviewXpForModeration(
      adminSupabase,
      {
        reviewId,
        userId: reviewData.user_id,
        listingId: reviewData.listing_id,
      },
      status,
    );

    return NextResponse.json({
      success: true,
      message: `Review ${status} successfully`,
      data: {
        review_id: reviewId,
        status,
        reason,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("POST /api/admin/reviews/[id]/moderate error:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Failed to moderate review" },
      { status: 500 },
    );
  }
}
