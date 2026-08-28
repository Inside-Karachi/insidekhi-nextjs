import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

type ReviewCommentRow = {
  id: number;
  review_id: number;
  user_id: string;
  content: string;
  status: string;
  parent_id: number | null;
  moderated_at: string | null;
  moderated_by: string | null;
  created_at: string;
  updated_at: string;
  edit_count: number | null;
  last_edited_at: string | null;
};

// POST /api/admin/comments/[commentId]/moderate - Moderate a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;

    // Check admin authentication
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin or lister role
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile || !["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const commentIdNum = parseInt(commentId);
    if (isNaN(commentIdNum)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status, remarks } = body;

    if (!status || !["approved", "rejected", "flagged"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid moderation status" },
        { status: 400 }
      );
    }

    // 1. Get the comment
    const { rows: commentRows } = await query(
      "SELECT * FROM public.review_comments WHERE id = $1 LIMIT 1",
      [commentIdNum]
    );
    const comment = commentRows[0] as ReviewCommentRow | undefined;

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // 2. Perform moderation update
    let updatedComment: ReviewCommentRow | undefined;
    try {
      const { rows: updatedRows } = await query(
        `UPDATE public.review_comments
         SET status = $1, moderated_at = $2, moderated_by = $3
         WHERE id = $4
         RETURNING *`,
        [status, new Date().toISOString(), session.userId, commentIdNum]
      );
      updatedComment = updatedRows[0] as ReviewCommentRow | undefined;
    } catch (updateError) {
      console.error("[MODERATE COMMENT API] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update comment status" },
        { status: 500 }
      );
    }

    if (!updatedComment) {
      console.error("[MODERATE COMMENT API] Update error: no row returned");
      return NextResponse.json(
        { error: "Failed to update comment status" },
        { status: 500 }
      );
    }

    // Attach profile info like the old `select("*, profile:profiles(*)")` did
    const { rows: profileForCommentRows } = await query(
      "SELECT * FROM public.profiles WHERE id = $1 LIMIT 1",
      [updatedComment.user_id]
    );
    const commentWithProfile = {
      ...updatedComment,
      profile: profileForCommentRows[0] ?? null,
    };

    // 3. Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action: "moderate_comment" as Parameters<
          typeof logAuditEvent
        >[0]["action"],
        user_id: session.userId,
        entity_type: "comment",
        entity_id: commentId,
        old_values: { status: comment.status },
        new_values: { status, remarks },
      });
    } catch (auditError) {
      console.error("[MODERATE COMMENT API] Failed to log audit event:", auditError);
    }

    // Acting on the content resolves any pending user reports against it -
    // best-effort, must never fail the moderation action itself.
    try {
      await query(
        `UPDATE public.content_reports
         SET status = 'resolved', resolved_by = $1, resolved_at = now()
         WHERE content_type = 'comment' AND content_id = $2 AND status = 'pending'`,
        [session.userId, commentIdNum],
      );
    } catch (reportsError) {
      console.error("[MODERATE COMMENT API] Failed to auto-resolve content reports:", reportsError);
    }

    return NextResponse.json({ success: true, comment: commentWithProfile });
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

    // Check admin authentication
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin or lister role (listers can moderate comments per requirements)
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile || !["admin", "super_admin", "lister"].includes(profile.role)) {
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
    const { rows: commentRows } = await query(
      "SELECT * FROM public.review_comments WHERE id = $1 LIMIT 1",
      [commentIdNum]
    );
    const comment = commentRows[0] as ReviewCommentRow | undefined;

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // 2. Delete comment (Atomic action)
    try {
      await query("DELETE FROM public.review_comments WHERE id = $1", [
        commentIdNum,
      ]);
    } catch (deleteError) {
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
        action: "delete_comment" as Parameters<
          typeof logAuditEvent
        >[0]["action"],
        user_id: session.userId,
        entity_type: "comment",
        entity_id: commentId,
        old_values: comment,
      });
    } catch (auditError) {
      console.error("[MODERATE COMMENT API] Failed to log audit event:", auditError);
    }

    // The content is gone - resolve any pending reports against it so they
    // don't sit in the queue forever.
    try {
      await query(
        `UPDATE public.content_reports
         SET status = 'resolved', resolved_by = $1, resolved_at = now()
         WHERE content_type = 'comment' AND content_id = $2 AND status = 'pending'`,
        [session.userId, commentIdNum],
      );
    } catch (reportsError) {
      console.error("[MODERATE COMMENT API] Failed to auto-resolve content reports:", reportsError);
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
