import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionFromCookies } from "@/lib/auth/session";
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
    const supabase = (await createServerSupabase()) as any;

    // Check admin authentication
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin or lister role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
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
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const body = (await request.json()) as any;
    const { status, remarks } = body;

    if (!status || !["approved", "rejected", "flagged"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid moderation status" },
        { status: 400 }
      );
    }

    // 1. Get the comment
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("*, profile:profiles(*)")
      .eq("id", commentIdNum)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // 2. Perform moderation update
    const { data: updatedComment, error: updateError } = await supabase
      .from("comments")
      .update({
        moderation_status: status,
        moderation_remarks: remarks || null,
        moderated_at: new Date().toISOString(),
        moderated_by: session.userId,
      })
      .eq("id", commentIdNum)
      .select("*, profile:profiles(*)")
      .single();

    if (updateError || !updatedComment) {
      console.error("[MODERATE COMMENT API] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update comment status" },
        { status: 500 }
      );
    }

    // 3. Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action: "moderate_comment" as any,
        user_id: session.userId,
        entity_type: "comment",
        entity_id: commentId,
        old_values: { moderation_status: comment.moderation_status },
        new_values: { moderation_status: status, remarks },
      });
    } catch (auditError) {
      console.error("[MODERATE COMMENT API] Failed to log audit event:", auditError);
    }

    return NextResponse.json({ success: true, comment: updatedComment });
  } catch (error) {
    console.error("[MODERATE COMMENT API] Fatal error:", error);
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
    const supabase = (await createServerSupabase()) as any;

    // Check admin authentication
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin or lister role (listers can moderate comments per requirements)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
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
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    // 1. Get comment for audit logging
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("*")
      .eq("id", commentIdNum)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // 2. Delete comment (Atomic action)
    const { error: deleteError } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentIdNum);

    if (deleteError) {
      console.error("[MODERATE COMMENT API] Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    // 3. Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action: "delete_comment" as any,
        user_id: session.userId,
        entity_type: "comment",
        entity_id: commentId,
        old_values: comment,
      });
    } catch (auditError) {
      console.error("[MODERATE COMMENT API] Failed to log audit event:", auditError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MODERATE COMMENT API] Fatal delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
