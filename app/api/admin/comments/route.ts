import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  getSupabaseClientForRole,
} from "@/lib/supabase/server";
import { CommentWithAuthor, CommentListResponse } from "@/types/comment.types";

// GET /api/admin/comments - Get all comments for moderation
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20"))
    );
    const offset = (page - 1) * limit;
    const status = searchParams.get("status"); // pending, approved, rejected, flagged
    const sort_by = searchParams.get("sort_by") || "created_at";
    const sort_order = searchParams.get("sort_order") || "desc";

    // Build query
    let query = adminSupabase.from("review_comments").select(
      `
        *,
        profiles!review_comments_user_id_fkey(full_name, avatar_url),
        reviews!review_comments_review_id_fkey(listing_id, user_id)
      `,
      { count: "exact" }
    );

    // Apply status filter if provided
    if (
      status &&
      ["pending", "approved", "rejected", "flagged"].includes(status)
    ) {
      query = query.eq("status", status);
    }

    // Apply sorting
    const validSortFields = ["created_at", "updated_at"];
    const sortField = validSortFields.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order === "asc" ? true : false;

    query = query.order(sortField, { ascending: sortDirection });
    query = query.range(offset, offset + limit - 1);

    const { data: comments, error: commentsError, count } = await query;

    if (commentsError) {
      console.error("Error fetching comments for moderation:", commentsError);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    // Transform data
    const transformedComments =
      comments?.map((comment) => ({
        ...comment,
        author_name: comment.profiles?.full_name || null,
        author_avatar: comment.profiles?.avatar_url || null,
      })) || [];

    // Get statistics
    const { data: statsData, error: statsError } = await adminSupabase
      .from("review_comments")
      .select("status");

    const statistics = (() => {
      const stats = {
        totalComments: 0,
        pendingComments: 0,
        approvedComments: 0,
        rejectedComments: 0,
        flaggedComments: 0,
      };
      if (!statsError && statsData) {
        stats.totalComments = statsData.length;
        statsData.forEach((comment) => {
          switch (comment.status) {
            case "pending":
              stats.pendingComments++;
              break;
            case "approved":
              stats.approvedComments++;
              break;
            case "rejected":
              stats.rejectedComments++;
              break;
            case "flagged":
              stats.flaggedComments++;
              break;
          }
        });
      }
      return stats;
    })();

    const response: CommentListResponse & { statistics: typeof statistics } = {
      comments: transformedComments as CommentWithAuthor[],
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
      statistics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
