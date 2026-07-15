import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { CommentWithAuthor, CommentListResponse } from "@/types/comment.types";

function commentColumns(alias: string): string {
  return (
    `${alias}.id, ${alias}.review_id, ${alias}.user_id, ${alias}.parent_id, ${alias}.content, ${alias}.status, ${alias}.moderated_by, ` +
    `to_json(${alias}.moderated_at) #>> '{}' AS moderated_at, ` +
    `to_json(${alias}.created_at) #>> '{}' AS created_at, ` +
    `to_json(${alias}.updated_at) #>> '{}' AS updated_at, ` +
    `${alias}.edit_count, ` +
    `to_json(${alias}.last_edited_at) #>> '{}' AS last_edited_at`
  );
}

function toNumericComment<T extends { id: unknown; review_id: unknown; parent_id: unknown }>(
  row: T
) {
  return {
    ...row,
    id: Number(row.id),
    review_id: Number(row.review_id),
    parent_id: row.parent_id !== null ? Number(row.parent_id) : null,
  };
}

// GET /api/reviews/[reviewId]/comments/[commentId]/replies - Get replies to a comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);

    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Check if parent comment exists and is approved
    const { rows: parentRows } = await query(
      `SELECT id, status FROM review_comments
       WHERE id = $1 AND review_id = $2 AND status = 'approved' AND parent_id IS NULL`,
      [commentId, reviewId]
    );

    if (!parentRows[0]) {
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
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM review_comments WHERE parent_id = $1 AND status = 'approved'`,
      [commentId]
    );
    const count = parseInt(countRows[0].count, 10);

    const { rows: replyRows } = await query(
      `SELECT ${commentColumns("c")},
         CASE WHEN p.id IS NOT NULL
           THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
           ELSE NULL
         END AS profiles
       FROM review_comments c
       LEFT JOIN profiles p ON p.id = c.user_id
       WHERE c.parent_id = $1 AND c.status = 'approved'
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [commentId, limit, offset]
    );

    // Transform data
    const transformedReplies = replyRows.map((reply) => ({
      ...toNumericComment(reply),
      author_name: reply.profiles?.full_name || null,
      author_avatar: reply.profiles?.avatar_url || null,
    }));

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
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Check if parent comment exists and is approved
    const { rows: parentRows } = await query(
      `SELECT id, status FROM review_comments
       WHERE id = $1 AND review_id = $2 AND status = 'approved' AND parent_id IS NULL`,
      [commentId, reviewId]
    );

    if (!parentRows[0]) {
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
    let newReply;
    try {
      const { rows: insertedRows } = await query(
        `WITH inserted AS (
           INSERT INTO review_comments (review_id, user_id, parent_id, content, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING *
         )
         SELECT ${commentColumns("inserted")},
           CASE WHEN p.id IS NOT NULL
             THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
             ELSE NULL
           END AS profiles
         FROM inserted
         LEFT JOIN profiles p ON p.id = inserted.user_id`,
        [reviewId, session.userId, commentId, content.trim()]
      );
      newReply = toNumericComment(insertedRows[0]);
    } catch (error) {
      console.error("Error creating reply:", error);
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
