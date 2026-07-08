import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ModerateCommentPayload,
  CommentWithAuthor,
} from "@/types/comment.types";

// POST /api/admin/comments/[commentId]/moderate - Moderate a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await createServerSupabase();

    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin or lister role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !["admin", "super_admin", "lister"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const commentIdNum = parseInt(commentId);
    if (isNaN(commentIdNum)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 }
      );
    }

    // Parse request body
    const body: ModerateCommentPayload = await request.json();
    const { status } = body;

    // Validate status
    if (
      !status ||
      !["pending", "approved", "rejected", "flagged"].includes(status)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be one of: pending, approved, rejected, flagged",
        },
        { status: 400 }
      );
    }

    // Check if comment exists
    const { data: existingComment, error: checkError } = await supabase
      .from("review_comments")
      .select("id, status")
      .eq("id", commentIdNum)
      .single();

    if (checkError || !existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Update the comment status
    const { data: updatedComment, error: updateError } = await supabase
      .from("review_comments")
      .update({
        status,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentIdNum)
      .select(
        `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url)
      `
      )
      .single();

    if (updateError) {
      console.error("Error moderating comment:", updateError);
      return NextResponse.json(
        { error: "Failed to moderate comment" },
        { status: 500 }
      );
    }

    // Transform the response data
    const transformedComment = {
      ...updatedComment,
      author_name: updatedComment.profiles?.full_name || null,
      author_avatar: updatedComment.profiles?.avatar_url || null,
    };

    return NextResponse.json({
      comment: transformedComment as CommentWithAuthor,
      message: `Comment ${status} successfully`,
    });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/admin/comments/[commentId]/moderate:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/comments/[commentId]/moderate - Delete a comment (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await createServerSupabase();

    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin or lister role (listers can moderate comments per requirements)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !["admin", "super_admin", "lister"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const deleteCommentIdNum = parseInt(commentId);
    if (isNaN(deleteCommentIdNum)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 }
      );
    }

    // Check if comment exists
    const { data: existingComment, error: checkError } = await supabase
      .from("review_comments")
      .select("id")
      .eq("id", deleteCommentIdNum)
      .single();

    if (checkError || !existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Delete the comment (this will cascade to delete replies)
    const { error: deleteError } = await supabase
      .from("review_comments")
      .delete()
      .eq("id", deleteCommentIdNum);

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
      "Unexpected error in DELETE /api/admin/comments/[commentId]/moderate:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
