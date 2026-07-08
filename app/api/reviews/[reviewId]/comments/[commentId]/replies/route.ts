import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { CommentWithAuthor, CommentListResponse } from "@/types/comment.types";

// GET /api/reviews/[reviewId]/comments/[commentId]/replies - Get replies to a comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);

    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Check if parent comment exists and is approved
    const { data: parentComment, error: parentError } = await supabase
      .from("review_comments")
      .select("id, status")
      .eq("id", commentId)
      .eq("review_id", reviewId)
      .eq("status", "approved")
      .is("parent_id", null)
      .single();

    if (parentError || !parentComment) {
      return NextResponse.json(
        { error: "Parent comment not found or not approved" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20"))
    );
    const offset = (page - 1) * limit;

    // Get replies with author info
    const {
      data: replies,
      error: repliesError,
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
      .eq("parent_id", commentId)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (repliesError) {
      console.error("Error fetching replies:", repliesError);
      return NextResponse.json(
        { error: "Failed to fetch replies" },
        { status: 500 }
      );
    }

    // Transform data
    const transformedReplies =
      replies?.map((reply) => ({
        ...reply,
        author_name: reply.profiles?.full_name || null,
        author_avatar: reply.profiles?.avatar_url || null,
      })) || [];

    const response: CommentListResponse = {
      comments: transformedReplies as CommentWithAuthor[],
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/reviews/[reviewId]/comments/[commentId]/replies:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/reviews/[reviewId]/comments/[commentId]/replies - Create a reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
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

    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Check if parent comment exists and is approved
    const { data: parentComment, error: parentError } = await supabase
      .from("review_comments")
      .select("id, status")
      .eq("id", commentId)
      .eq("review_id", reviewId)
      .eq("status", "approved")
      .is("parent_id", null)
      .single();

    if (parentError || !parentComment) {
      return NextResponse.json(
        { error: "Parent comment not found or not approved" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Reply content is required" },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Reply content must be less than 2000 characters" },
        { status: 400 }
      );
    }

    // Create the reply
    const { data: newReply, error: insertError } = await supabase
      .from("review_comments")
      .insert({
        review_id: reviewId,
        user_id: user.id,
        parent_id: commentId,
        content: content.trim(),
        status: "pending", // All new replies start as pending
      })
      .select(
        `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url)
      `
      )
      .single();

    if (insertError) {
      console.error("Error creating reply:", insertError);
      return NextResponse.json(
        { error: "Failed to create reply" },
        { status: 500 }
      );
    }

    // Transform the response data
    const transformedReply = {
      ...newReply,
      author_name: newReply.profiles?.full_name || null,
      author_avatar: newReply.profiles?.avatar_url || null,
    };

    return NextResponse.json({
      reply: transformedReply as CommentWithAuthor,
      message: "Reply submitted for review",
    });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/reviews/[reviewId]/comments/[commentId]/replies:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
