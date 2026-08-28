import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

// POST /api/admin/reports/[id]/dismiss - Mark one report as reviewed and
// not actionable (the underlying review/comment is left untouched).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId)) {
      return NextResponse.json(
        { success: false, error: "Invalid report ID" },
        { status: 400 },
      );
    }

    const { rows } = await query(
      `UPDATE public.content_reports
       SET status = 'dismissed', resolved_by = $1, resolved_at = now()
       WHERE id = $2 AND status = 'pending'
       RETURNING content_type, content_id`,
      [session.userId, reportId],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Report not found or already resolved" },
        { status: 404 },
      );
    }

    try {
      const { logContentReportDismissed } = await import("@/lib/audit");
      await logContentReportDismissed(
        session.userId,
        rows[0].content_type,
        rows[0].content_id,
      );
    } catch (err) {
      console.error("[dismiss-report] audit log failed (non-fatal):", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/reports/[id]/dismiss error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
