import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  CreateCommentPayload,
  CommentWithAuthor,
  CommentListResponse,
} from "@/types/comment.types";

// GET /api/reviews/[reviewId]/comments - Get comments for a review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);

    const { reviewId: reviewIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    if (isNaN(reviewId)) {
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    // Check if user is admin (must verify role, not just login status)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    let isAdmin = false;
    if (user && !userError) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin =
        profile?.role === "admin" || profile?.role === "super_admin";
    }

    // Check if review exists (admins can see comments on all reviews, regular users only on approved reviews)
    let reviewQuery = supabase
      .from("reviews")
      .select("id, status")
      .eq("id", reviewId);

    if (!isAdmin) {
      reviewQuery = reviewQuery.eq("status", "approved");
    }

    const { data: review, error: reviewError } = await reviewQuery.single();

    if (reviewError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20"))
    );
    const offset = (page - 1) * limit;

    // Get top-level comments with author info
    const {
      data: comments,
      error: commentsError,
      count,
    } = await supabase
      .from("review_comments")
      .select(
        `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url)
      `,
        { count: "exact" }
      )
      .eq("review_id", reviewId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (commentsError) {
      console.error("Error fetching comments:", commentsError);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    // Get reply counts for each comment
    const commentIds = comments?.map((c) => c.id) || [];
    const { data: replyCounts } = await supabase
      .from("review_comments")
      .select("parent_id")
      .in("parent_id", commentIds);

    // Add reply counts to comments and transform data
    const commentsWithReplyCount =
      comments?.map((comment) => ({
        ...comment,
        author_name: comment.profiles?.full_name || null,
        author_avatar: comment.profiles?.avatar_url || null,
        reply_count:
          replyCounts?.filter((r) => r.parent_id === comment.id).length || 0,
      })) || [];

    const response: CommentListResponse = {
      comments: commentsWithReplyCount as CommentWithAuthor[],
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/reviews/[reviewId]/comments:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/reviews/[reviewId]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewId: reviewIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    if (isNaN(reviewId)) {
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    // Check if review exists (admins can comment on all reviews, regular users only on approved reviews)
    // First check user's admin status
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin =
      profile?.role === "admin" || profile?.role === "super_admin";

    let reviewQuery = supabase
      .from("reviews")
      .select("id, status")
      .eq("id", reviewId);

    if (!isAdmin) {
      reviewQuery = reviewQuery.eq("status", "approved");
    }

    const { data: review, error: reviewError } = await reviewQuery.single();

    if (reviewError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Parse request body
    const body: CreateCommentPayload = await request.json();
    const { content, parent_id } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Comment content must be less than 2000 characters" },
        { status: 400 }
      );
    }

    // If this is a reply, validate parent comment exists
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from("review_comments")
        .select("id, review_id")
        .eq("id", parent_id)
        .eq("review_id", reviewId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
    }

    // Create the comment
    const { data: newComment, error: insertError } = await supabase
      .from("review_comments")
      .insert({
        review_id: reviewId,
        user_id: user.id,
        content: content.trim(),
        parent_id: parent_id || null,
        status: "pending", // All new comments start as pending
      })
      .select(
        `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url)
      `
      )
      .single();

    if (insertError) {
      console.error("Error creating comment:", insertError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    // Transform the response data
    const transformedComment = {
      ...newComment,
      author_name: newComment.profiles?.full_name || null,
      author_avatar: newComment.profiles?.avatar_url || null,
    };

    // Award XP for commenting on a review (max 10/day per activity rules)
    try {
      const { awardXP } = await import("@/lib/gamification");
      // Use review ID as related_id for audit purposes (comment_review is unlimited with daily cap)
      const xpResult = await awardXP(user.id, "comment_review", reviewId);

      if ("error" in xpResult) {
        console.error(
          `[REVIEW COMMENT XP] Failed for user ${user.id} on review ${reviewId}:`,
          xpResult.error,
          xpResult.details
        );
      } else {
        console.log(
          `[REVIEW COMMENT XP] Awarded ${xpResult.xp_awarded} XP to user ${user.id}`
        );
      }
    } catch (xpError) {
      console.error(
        `[REVIEW COMMENT XP] Exception for user ${user.id} on review ${reviewId}:`,
        xpError
      );
    }

    return NextResponse.json({
      comment: transformedComment as CommentWithAuthor,
      message: "Comment submitted for review",
    });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/reviews/[reviewId]/comments:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
