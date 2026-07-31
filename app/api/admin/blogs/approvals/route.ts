import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { createNotification } from "@/lib/notifications/service";
import { getPostCategoriesMap } from "@/lib/blogs/categories";

export const dynamic = "force-dynamic";

// GET - Get posts for approval (default: pending_approval), plus status tallies
export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending_approval";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const whereParams: unknown[] = [];
    let whereSql = "";
    if (status && status !== "all") {
      whereParams.push(status);
      whereSql = `WHERE status = $${whereParams.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM posts ${whereSql}`,
      whereParams,
    );
    const count = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    const listParams = [...whereParams, limit, offset];
    const { rows: posts } = await query(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.status, p.author_id,
              to_json(p.submitted_at) #>> '{}' AS submitted_at,
              to_json(p.created_at) #>> '{}' AS created_at,
              pr.full_name AS author_full_name
       FROM posts p
       LEFT JOIN profiles pr ON pr.id = p.author_id
       ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const postIds = posts.map((p) => Number(p.id));
    const categoriesByPost = await getPostCategoriesMap(postIds);

    const [draftResult, pendingResult, publishedResult, rejectedResult] =
      await Promise.all([
        query(`SELECT COUNT(*) FROM posts WHERE status = 'draft'`),
        query(`SELECT COUNT(*) FROM posts WHERE status = 'pending_approval'`),
        query(`SELECT COUNT(*) FROM posts WHERE status = 'published'`),
        query(`SELECT COUNT(*) FROM posts WHERE status = 'rejected'`),
      ]);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        posts: posts.map((p) => ({
          ...p,
          id: Number(p.id),
          categories: categoriesByPost.get(Number(p.id)) ?? [],
        })),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        draftCount: parseInt(draftResult.rows[0].count, 10) || 0,
        pendingCount: parseInt(pendingResult.rows[0].count, 10) || 0,
        publishedCount: parseInt(publishedResult.rows[0].count, 10) || 0,
        rejectedCount: parseInt(rejectedResult.rows[0].count, 10) || 0,
      },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("Error in blog approvals GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Approve or reject a post
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireStaff(request);

    const body = await request.json();
    const {
      post_id,
      action,
      review_notes,
    }: { post_id: number; action: "approve" | "reject"; review_notes?: string } =
      body;

    if (!post_id) {
      return NextResponse.json(
        { success: false, error: "Post ID is required" },
        { status: 400 },
      );
    }
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 },
      );
    }
    if (action === "reject" && !review_notes?.trim()) {
      return NextResponse.json(
        { success: false, error: "Review notes required for rejection" },
        { status: 400 },
      );
    }

    const { rows: postRows } = await query(
      `SELECT id, title, status, author_id FROM posts WHERE id = $1`,
      [post_id],
    );
    const post = postRows[0];
    if (!post) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 },
      );
    }
    if (post.status !== "pending_approval") {
      return NextResponse.json(
        { success: false, error: "Only pending posts can be approved/rejected" },
        { status: 400 },
      );
    }

    const newStatus = action === "approve" ? "published" : "rejected";
    const now = new Date().toISOString();

    const setClauses = [
      "status = $1",
      "reviewed_at = $2",
      "reviewed_by = $3",
      "review_notes = $4",
      "updated_at = $5",
    ];
    const values: unknown[] = [newStatus, now, user.id, review_notes || null, now];

    if (action === "approve") {
      values.push(now);
      setClauses.push(`published_at = $${values.length}`);
    }

    values.push(post_id);
    await query(
      `UPDATE posts SET ${setClauses.join(", ")} WHERE id = $${values.length}`,
      values,
    );

    try {
      await createNotification({
        recipientId: post.author_id,
        roleScope: "writer",
        categorySlug: "general",
        title: action === "approve" ? "Blog Post Approved" : "Blog Post Needs Changes",
        body:
          action === "approve"
            ? `Your post "${post.title}" has been approved and is now live!`
            : `Your post "${post.title}" needs revisions. ${review_notes || ""}`,
        priority: action === "approve" ? "normal" : "high",
        ctaLabel: "View Post",
        ctaUrl: `/dashboard/writer/blogs/${post.id}`,
        metadata: {
          post_id: post.id,
          post_title: post.title,
          review_notes: review_notes || "",
          action,
        },
      });
    } catch (notifError) {
      console.error("Failed to send notification:", notifError);
    }

    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action: "post_updated",
        entity_type: "blog_post",
        entity_id: post_id.toString(),
        admin_id: user.id,
        new_values: { status: newStatus, review_notes: review_notes || "No notes provided" },
        metadata: { post_title: post.title, author_id: post.author_id },
        ip_address:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        user_agent: request.headers.get("user-agent") || undefined,
      });
    } catch (logError) {
      console.error("Failed to log action:", logError);
    }

    return NextResponse.json({
      success: true,
      data: {
        post_id: post.id,
        status: newStatus,
        message: `Post ${action === "approve" ? "approved" : "rejected"} successfully`,
      },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("Error in blog approvals POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
