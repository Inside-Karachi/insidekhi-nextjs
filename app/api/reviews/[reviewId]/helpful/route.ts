import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const session = await getSession(request);
    const { reviewId } = await params;

    // Check authentication
    if (!session) {
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
    const { rows: reviewRows } = await query(
      `SELECT id, user_id, status FROM reviews WHERE id = $1`,
      [parsedReviewId]
    );
    const review = reviewRows[0];

    if (!review) {
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
    if (review.user_id === session.userId) {
      return NextResponse.json(
        { success: false, error: "Cannot vote on your own review" },
        { status: 400 }
      );
    }

    // Check if user already voted
    const { rows: existingVoteRows } = await query(
      `SELECT user_id FROM helpful_reviews WHERE user_id = $1 AND review_id = $2`,
      [session.userId, parsedReviewId]
    );

    if (existingVoteRows.length > 0) {
      return NextResponse.json(
        { success: false, error: "Already voted on this review" },
        { status: 400 }
      );
    }

    // Insert helpful vote (reviews.helpful_count is kept in sync by the
    // trigger_update_helpful_count DB trigger)
    try {
      await query(
        `INSERT INTO helpful_reviews (user_id, review_id) VALUES ($1, $2)`,
        [session.userId, parsedReviewId]
      );
    } catch (error) {
      console.error("Error inserting helpful vote:", error);
      return NextResponse.json(
        { success: false, error: "Failed to record vote" },
        { status: 500 }
      );
    }

    // Get updated helpful count
    const { rows: updatedRows } = await query(
      `SELECT helpful_count FROM reviews WHERE id = $1`,
      [parsedReviewId]
    );
    const updatedReview = updatedRows[0];

    // Award XP for reacting to a review (max 10/day per activity rules)
    try {
      const { awardXP } = await import("@/lib/gamification");
      const xpResult = await awardXP(
        session.userId,
        "react_review",
        parsedReviewId
      );

      if ("error" in xpResult) {
        console.error(
          `[REVIEW REACTION XP] Failed for user ${session.userId} on review ${reviewId}:`,
          xpResult.error,
          xpResult.details
        );
      } else {
        console.log(
          `[REVIEW REACTION XP] Awarded ${xpResult.xp_awarded} XP to user ${session.userId}`
        );
      }
    } catch (xpError) {
      console.error(
        `[REVIEW REACTION XP] Exception for user ${session.userId} on review ${reviewId}:`,
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
    const { reviewId } = await params;
    const parsedReviewId = parseInt(reviewId, 10);
    if (isNaN(parsedReviewId)) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 }
      );
    }

    // Check authentication
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Remove helpful vote
    try {
      await query(
        `DELETE FROM helpful_reviews WHERE user_id = $1 AND review_id = $2`,
        [session.userId, parsedReviewId]
      );
    } catch (error) {
      console.error("Error removing helpful vote:", error);
      return NextResponse.json(
        { success: false, error: "Failed to remove vote" },
        { status: 500 }
      );
    }

    // Get updated helpful count
    const { rows: updatedRows } = await query(
      `SELECT helpful_count FROM reviews WHERE id = $1`,
      [parsedReviewId]
    );
    const updatedReview = updatedRows[0];

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
    const { reviewId } = await params;
    const parsedReviewId = parseInt(reviewId, 10);
    if (isNaN(parsedReviewId)) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 }
      );
    }

    // Check authentication
    const session = await getSession(request);

    // Get review with helpful count (this doesn't require authentication)
    const { rows: reviewRows } = await query(
      `SELECT helpful_count FROM reviews WHERE id = $1`,
      [parsedReviewId]
    );
    const review = reviewRows[0];

    if (!review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    // If user is not authenticated, return helpful count with user_voted: false
    if (!session) {
      return NextResponse.json({
        success: true,
        data: {
          helpful_count: review.helpful_count || 0,
          user_voted: false,
        },
      });
    }

    // Check if authenticated user already voted
    const { rows: userVoteRows } = await query(
      `SELECT user_id FROM helpful_reviews WHERE user_id = $1 AND review_id = $2`,
      [session.userId, parsedReviewId]
    );

    return NextResponse.json({
      success: true,
      data: {
        helpful_count: review.helpful_count || 0,
        user_voted: userVoteRows.length > 0,
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
