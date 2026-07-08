import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { reviewId } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const parsedReviewId = parseInt(reviewId, 10);
    if (isNaN(parsedReviewId)) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 }
      );
    }

    // Validate review exists and is approved
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("id, user_id, status")
      .eq("id", parsedReviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    // Check if review is approved
    if (review.status !== "approved") {
      return NextResponse.json(
        { success: false, error: "Cannot vote on unapproved review" },
        { status: 400 }
      );
    }

    // Prevent self-voting
    if (review.user_id === user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot vote on your own review" },
        { status: 400 }
      );
    }

    // Check if user already voted
    const { data: existingVote, error: _voteCheckError } = await supabase
      .from("helpful_reviews")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("review_id", parsedReviewId)
      .maybeSingle();

    if (existingVote) {
      return NextResponse.json(
        { success: false, error: "Already voted on this review" },
        { status: 400 }
      );
    }

    // Insert helpful vote
    const { error: insertError } = await supabase
      .from("helpful_reviews")
      .insert({
        user_id: user.id,
        review_id: parsedReviewId,
      });

    if (insertError) {
      console.error("Error inserting helpful vote:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to record vote" },
        { status: 500 }
      );
    }

    // Get updated helpful count
    const { data: updatedReview, error: _countError } = await supabase
      .from("reviews")
      .select("helpful_count")
      .eq("id", parsedReviewId)
      .single();

    // Award XP for reacting to a review (max 10/day per activity rules)
    try {
      const { awardXP } = await import("@/lib/gamification");
      const xpResult = await awardXP(
        user.id,
        "react_review",
        parsedReviewId
      );

      if ("error" in xpResult) {
        console.error(
          `[REVIEW REACTION XP] Failed for user ${user.id} on review ${reviewId}:`,
          xpResult.error,
          xpResult.details
        );
      } else {
        console.log(
          `[REVIEW REACTION XP] Awarded ${xpResult.xp_awarded} XP to user ${user.id}`
        );
      }
    } catch (xpError) {
      console.error(
        `[REVIEW REACTION XP] Exception for user ${user.id} on review ${reviewId}:`,
        xpError
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        helpful_count: updatedReview?.helpful_count || 0,
        user_voted: true,
      },
    });
  } catch (error) {
    console.error("POST /api/reviews/[reviewId]/helpful error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { reviewId } = await params;
    const parsedReviewId = parseInt(reviewId, 10);
    if (isNaN(parsedReviewId)) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 }
      );
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Remove helpful vote
    const { error: deleteError } = await supabase
      .from("helpful_reviews")
      .delete()
      .eq("user_id", user.id)
      .eq("review_id", parsedReviewId);

    if (deleteError) {
      console.error("Error removing helpful vote:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to remove vote" },
        { status: 500 }
      );
    }

    // Get updated helpful count
    const { data: updatedReview, error: _countError } = await supabase
      .from("reviews")
      .select("helpful_count")
      .eq("id", parsedReviewId)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        helpful_count: updatedReview?.helpful_count || 0,
        user_voted: false,
      },
    });
  } catch (error) {
    console.error("DELETE /api/reviews/[reviewId]/helpful error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { reviewId } = await params;
    const parsedReviewId = parseInt(reviewId, 10);
    if (isNaN(parsedReviewId)) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 }
      );
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Get review with helpful count (this doesn't require authentication)
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("helpful_count")
      .eq("id", parsedReviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    // If user is not authenticated, return helpful count with user_voted: false
    if (authError || !user) {
      return NextResponse.json({
        success: true,
        data: {
          helpful_count: review.helpful_count || 0,
          user_voted: false,
        },
      });
    }

    // Check if authenticated user already voted
    const { data: userVote, error: _voteError } = await supabase
      .from("helpful_reviews")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("review_id", parsedReviewId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        helpful_count: review.helpful_count || 0,
        user_voted: !!userVote,
      },
    });
  } catch (error) {
    console.error("GET /api/reviews/[reviewId]/helpful error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
