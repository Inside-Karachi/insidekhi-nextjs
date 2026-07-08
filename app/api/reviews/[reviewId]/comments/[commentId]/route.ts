import type { Database } from "@/types/supabase";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { CommentWithAuthor, CommentStatus } from "@/types/comment.types";

// GET /api/reviews/[reviewId]/comments/[commentId] - Get a specific comment with its replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    const supabase = await createServerSupabase();

    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Get the main comment with author info
    const { data: comment, error: commentError } = await supabase
      .from("review_comments")
      .select(
        `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url)
      `
      )
      .eq("id", commentId)
      .eq("review_id", reviewId)
      .eq("status", "approved")
      .is("parent_id", null)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Get replies to this comment
    const { data: replies, error: repliesError } = await supabase
      .from("review_comments")
      .select(
        `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url)
      `
      )
      .eq("parent_id", commentId)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (repliesError) {
      console.error("Error fetching replies:", repliesError);
      return NextResponse.json(
        { error: "Failed to fetch replies" },
        { status: 500 }
      );
    }

    // Transform data
    const transformedComment = {
      ...comment,
      author_name: comment.profiles?.full_name || null,
      author_avatar: comment.profiles?.avatar_url || null,
    };

    const transformedReplies =
      replies?.map((reply) => ({
        ...reply,
        author_name: reply.profiles?.full_name || null,
        author_avatar: reply.profiles?.avatar_url || null,
      })) || [];

    return NextResponse.json({
      thread: {
        comment: transformedComment as CommentWithAuthor,
        replies: transformedReplies as CommentWithAuthor[],
      },
      total_replies: transformedReplies.length,
    });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/reviews/[reviewId]/comments/[commentId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/reviews/[reviewId]/comments/[commentId] - Update a comment
export async function PUT(
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

    // Parse request body - support both content updates and status moderation
    const body = await request.json();
    const { content, status } = body;

    // Check if user is admin for status updates
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isAdmin =
      profile?.role === "admin" || profile?.role === "super_admin";

    // Validate request
    if (content !== undefined && status !== undefined) {
      return NextResponse.json(
        { error: "Cannot update both content and status in one request" },
        { status: 400 }
      );
    }

    if (!content && !status) {
      return NextResponse.json(
        { error: "Either content or status must be provided" },
        { status: 400 }
      );
    }

    // Validate content if provided
    if (content !== undefined) {
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
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses: CommentStatus[] = [
        "pending",
        "approved",
        "rejected",
        "flagged",
      ];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
    }

    // Check if comment exists and user owns it
    const { data: existingComment, error: checkError } = await supabase
      .from("review_comments")
      .select("id, user_id, status")
      .eq("id", commentId)
      .eq("review_id", reviewId)
      .single();

    if (checkError || !existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check permissions based on operation type
    if (content !== undefined) {
      // Content updates: only comment owner can edit pending comments
      if (existingComment.user_id !== user.id) {
        return NextResponse.json(
          { error: "You can only edit your own comments" },
          { status: 403 }
        );
      }

      if (existingComment.status !== "pending") {
        return NextResponse.json(
          { error: "You can only edit pending comments" },
          { status: 400 }
        );
      }
    } else if (status !== undefined) {
      // Status updates: only admins can moderate
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Admin access required for moderation" },
          { status: 403 }
        );
      }
    }

    // Prepare update data
    const updateData: Partial<
      Database["public"]["Tables"]["review_comments"]["Row"]
    > = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) {
      updateData.content = content.trim();
    }

    if (status !== undefined) {
      updateData.status = status;
      updateData.moderated_by = user.id;
      updateData.moderated_at = new Date().toISOString();
    }

    // Omit 'id' from updateData for Supabase update
    const { id: _, ...safeUpdateData } = updateData;
    const { data: updatedComment, error: updateError } = await supabase
      .from("review_comments")
      .update(safeUpdateData)
      .eq("id", commentId)
      .eq("review_id", reviewId)
      .select(
        `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url)
      `
      )
      .single();

    if (updateError) {
      console.error("Error updating comment:", updateError);
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }

    // Transform the response data
    const transformedComment = updatedComment
      ? {
          ...updatedComment,
          author_name: updatedComment.profiles?.full_name || null,
          author_avatar: updatedComment.profiles?.avatar_url || null,
        }
      : null;

    return NextResponse.json({
      comment: transformedComment as CommentWithAuthor,
      message: "Comment updated successfully",
    });
  } catch (error) {
    console.error(
      "Unexpected error in PUT /api/reviews/[reviewId]/comments/[commentId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/reviews/[reviewId]/comments/[commentId] - Delete a comment
export async function DELETE(
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

    // Check if comment exists and user owns it
    const { data: existingComment, error: checkError } = await supabase
      .from("review_comments")
      .select("id, user_id, status")
      .eq("id", commentId)
      .eq("review_id", reviewId)
      .single();

    if (checkError || !existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existingComment.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    if (existingComment.status !== "pending") {
      return NextResponse.json(
        { error: "You can only delete pending comments" },
        { status: 400 }
      );
    }

    // Delete the comment (this will cascade to delete replies)
    const { error: deleteError } = await supabase
      .from("review_comments")
      .delete()
      .eq("id", commentId)
      .eq("review_id", reviewId);

    if (deleteError) {
      console.error("Error deleting comment:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/reviews/[reviewId]/comments/[commentId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
