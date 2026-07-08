import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  verifyBusinessOwner,
  apiSuccess,
  apiError,
  handleApiError,
  canEditReply,
} from "@/lib/business-owner/api-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const updateReplySchema = z.object({
  content: z.string().min(10).max(1000),
});

/**
 * PATCH /api/business/reviews/reply/[id]
 * Edit own review reply (within 24h window and edit limit)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const replyId = parseInt(id, 10);

    if (isNaN(replyId)) {
      return apiError("Invalid reply ID", 400);
    }

    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();

    const body = await request.json();
    const validation = updateReplySchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Invalid input: " + validation.error.errors[0].message,
        400,
      );
    }

    const { content } = validation.data;

    // Get the reply and verify ownership
    const { data: reply, error: replyError } = await supabase
      .from("review_comments")
      .select("id, user_id, created_at, edit_count, status")
      .eq("id", replyId)
      .single();

    if (replyError || !reply) {
      return apiError("Reply not found", 404);
    }

    if (reply.user_id !== userId) {
      return apiError("You do not own this reply", 403);
    }

    // Check if reply can be edited (24h window + edit limit + pending status)
    const editCheck = await canEditReply(
      reply.created_at,
      reply.edit_count || 0,
      reply.status || "pending",
    );

    if (!editCheck.can_edit) {
      return apiError(editCheck.reason || "Cannot edit this reply", 403);
    }

    // Update the reply
    const { data: updatedReply, error: updateError } = await supabase
      .from("review_comments")
      .update({
        content,
        edit_count: (reply.edit_count || 0) + 1,
        last_edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", replyId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update reply: ${updateError.message}`);
    }

    return apiSuccess({
      reply: updatedReply,
      edits_remaining: Math.max(
        0,
        3 - ((reply.edit_count || 0) + 1),
      ),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/business/reviews/reply/[id]
 * Delete own review reply (within 24h window and pending status only)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const replyId = parseInt(id, 10);

    if (isNaN(replyId)) {
      return apiError("Invalid reply ID", 400);
    }

    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();

    // Get the reply and verify ownership
    const { data: reply, error: replyError } = await supabase
      .from("review_comments")
      .select("id, user_id, created_at, status")
      .eq("id", replyId)
      .single();

    if (replyError || !reply) {
      return apiError("Reply not found", 404);
    }

    if (reply.user_id !== userId) {
      return apiError("You do not own this reply", 403);
    }

    // Can only delete pending replies
    if (reply.status !== "pending") {
      return apiError(
        "Approved replies cannot be deleted. Contact support if needed.",
        403,
      );
    }

    // Check 24-hour window
    const createdDate = new Date(reply.created_at);
    const now = new Date();
    const hoursSinceCreation =
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > 24) {
      return apiError("Delete window expired (24 hours)", 403);
    }

    // Delete the reply
    const { error: deleteError } = await supabase
      .from("review_comments")
      .delete()
      .eq("id", replyId);

    if (deleteError) {
      throw new Error(`Failed to delete reply: ${deleteError.message}`);
    }

    return apiSuccess({ deleted: true }, "Reply deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
