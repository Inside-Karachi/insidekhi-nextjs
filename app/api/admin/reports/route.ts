import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

// GET /api/admin/reports - Unified queue of user-submitted reports on
// reviews and comments, newest first.
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId],
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20")),
    );
    const offset = (page - 1) * limit;

    const status = searchParams.get("status") || "pending";
    const contentType = searchParams.get("content_type");
    const reason = searchParams.get("reason");

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status && status !== "all") {
      conditions.push(`cr.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (contentType && ["review", "comment"].includes(contentType)) {
      conditions.push(`cr.content_type = $${paramIdx}`);
      params.push(contentType);
      paramIdx++;
    }
    if (reason && reason !== "all") {
      conditions.push(`cr.reason = $${paramIdx}`);
      params.push(reason);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const reportsSql = `
      SELECT
        cr.id, cr.content_type, cr.content_id, cr.reason, cr.details, cr.status,
        cr.created_at, cr.resolved_at, cr.resolved_by,
        reporter.full_name AS reporter_name,
        CASE WHEN cr.content_type = 'review' THEN r.comment ELSE rc.content END AS content_snippet,
        CASE WHEN cr.content_type = 'review' THEN r.rating ELSE NULL END AS rating,
        CASE WHEN cr.content_type = 'review' THEN r.status ELSE rc.status END AS content_status,
        COALESCE(rl.name, cl.name) AS listing_name,
        COALESCE(rl.slug, cl.slug) AS listing_slug
      FROM public.content_reports cr
      LEFT JOIN public.profiles reporter ON reporter.id = cr.reporter_id
      LEFT JOIN public.reviews r ON cr.content_type = 'review' AND r.id = cr.content_id
      LEFT JOIN public.listings rl ON rl.id = r.listing_id
      LEFT JOIN public.review_comments rc ON cr.content_type = 'comment' AND rc.id = cr.content_id
      LEFT JOIN public.reviews parent_review ON parent_review.id = rc.review_id
      LEFT JOIN public.listings cl ON cl.id = parent_review.listing_id
      ${whereClause}
      ORDER BY cr.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const { rows: reports } = await query(reportsSql, params);

    const countParams = params.slice(0, paramIdx - 1);
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.content_reports cr
      ${whereClause}
    `;
    const { rows: countRows } = await query(countSql, countParams);
    const total = (countRows[0] as { total: number })?.total ?? 0;

    const { rows: statusCountRows } = await query(
      `SELECT status, COUNT(*)::int AS count FROM public.content_reports GROUP BY status`,
    );
    const statusCounts = { pending: 0, resolved: 0, dismissed: 0 };
    (statusCountRows as { status: string; count: number }[]).forEach((row) => {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts] = row.count;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        reports,
        total,
        page,
        limit,
        statusCounts,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/reports error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
