import { NextRequest, NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

// GET - list writer applications by status (default: pending), plus tallies
export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const whereParams: unknown[] = [];
    let whereSql = "";
    if (status && status !== "all") {
      whereParams.push(status);
      whereSql = `WHERE wa.status = $${whereParams.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM writer_applications wa ${whereSql}`,
      whereParams,
    );
    const count = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    const listParams = [...whereParams, limit, offset];
    const { rows: applications } = await query(
      `SELECT wa.id, wa.user_id, wa.message, wa.portfolio_url, wa.status, wa.review_notes,
              to_json(wa.created_at) #>> '{}' AS created_at,
              pr.full_name AS applicant_full_name
       FROM writer_applications wa
       LEFT JOIN profiles pr ON pr.id = wa.user_id
       ${whereSql}
       ORDER BY wa.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM writer_applications WHERE status = 'pending'`),
      query(`SELECT COUNT(*) FROM writer_applications WHERE status = 'approved'`),
      query(`SELECT COUNT(*) FROM writer_applications WHERE status = 'rejected'`),
    ]);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        applications: applications.map((a) => ({ ...a, id: Number(a.id) })),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        pendingCount: parseInt(pendingResult.rows[0].count, 10) || 0,
        approvedCount: parseInt(approvedResult.rows[0].count, 10) || 0,
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
    console.error("Error in writer-applications GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - approve or reject a writer application
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireStaff(request);

    const body = await request.json();
    const {
      application_id,
      action,
      review_notes,
    }: {
      application_id: number;
      action: "approve" | "reject";
      review_notes?: string;
    } = body;

    if (!application_id) {
      return NextResponse.json(
        { success: false, error: "Application ID is required" },
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

    const { rows: applicationRows } = await query(
      `SELECT id, user_id, status FROM writer_applications WHERE id = $1`,
      [application_id],
    );
    const application = applicationRows[0];
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 },
      );
    }
    if (application.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Only pending applications can be approved/rejected" },
        { status: 400 },
      );
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const now = new Date().toISOString();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE writer_applications
         SET status = $1, reviewed_at = $2, reviewed_by = $3, review_notes = $4, updated_at = $2
         WHERE id = $5`,
        [newStatus, now, user.id, review_notes || null, application_id],
      );

      if (action === "approve") {
        await client.query(
          `UPDATE profiles SET role = 'writer', active_role = 'writer' WHERE id = $1`,
          [application.user_id],
        );
      }

      await client.query("COMMIT");
    } catch (txError) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw txError;
    } finally {
      client.release();
    }

    try {
      await createNotification({
        recipientId: application.user_id,
        roleScope: action === "approve" ? "writer" : "public_user",
        categorySlug: "general",
        title: action === "approve" ? "Writer Application Approved" : "Writer Application Update",
        body:
          action === "approve"
            ? "Congratulations! You're now a blog writer. You can start drafting posts."
            : `Your writer application wasn't approved this time. ${review_notes || ""}`,
        priority: "normal",
        ctaLabel: action === "approve" ? "Write a Post" : undefined,
        ctaUrl: action === "approve" ? "/dashboard/writer/blogs" : undefined,
        metadata: {
          application_id: application.id,
          action,
          review_notes: review_notes || "",
        },
      });
    } catch (notifError) {
      console.error("Failed to send notification:", notifError);
    }

    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action: "writer_application_reviewed",
        entity_type: "writer_application",
        entity_id: application_id.toString(),
        admin_id: user.id,
        user_id: application.user_id,
        new_values: { status: newStatus, review_notes: review_notes || "No notes provided" },
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
        application_id: application.id,
        status: newStatus,
        message: `Application ${action === "approve" ? "approved" : "rejected"} successfully`,
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
    console.error("Error in writer-applications POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
