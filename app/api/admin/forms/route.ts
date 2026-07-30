import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import type { Database } from "@/types/database";
import type { FormSubmissionWithAssets } from "@/types/form.types";

// GET all form submissions (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { searchParams } = new URL(request.url);

    const formType = searchParams.get("form_type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const offset = (page - 1) * limit;

    // Table/column names below are fixed - never user input.
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (formType) {
      params.push(formType);
      whereClauses.push(`form_type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      whereClauses.push(`status = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      whereClauses.push(`submitted_at >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      whereClauses.push(`submitted_at <= $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      whereClauses.push(
        `(name ILIKE $${idx} OR company_name ILIKE $${idx} OR email ILIKE $${idx})`
      );
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const dataParams = [...params, limit, offset];
    let data: Array<Record<string, unknown>>;
    try {
      const result = await query(
        `SELECT * FROM form_submissions ${whereSql}
         ORDER BY submitted_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );
      data = result.rows;
    } catch (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch form submissions" },
        { status: 500 }
      );
    }

    const submissionIds = data.map((submission) => submission.id as number);
    let imagesBySubmission = new Map<
      number,
      Database["public"]["Tables"]["form_submission_images"]["Row"][]
    >();

    if (submissionIds.length > 0) {
      const { rows: imageRows } = await query(
        `SELECT * FROM form_submission_images WHERE submission_id = ANY($1::int[])`,
        [submissionIds],
      );

      imagesBySubmission = imageRows.reduce((map, image) => {
        const list = map.get(image.submission_id) ?? [];
        list.push(image);
        map.set(image.submission_id, list);
        return map;
      }, new Map<number, Database["public"]["Tables"]["form_submission_images"]["Row"][]>());
    }

    // Get total count for pagination
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM form_submissions ${whereSql}`,
      params,
    );
    const count = parseInt(countRows[0].count, 10);

    const [totalRes, pendingRes, recentRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM form_submissions`),
      query(
        `SELECT COUNT(*) FROM form_submissions WHERE status IS NULL OR status = 'pending'`,
      ),
      query(
        `SELECT COUNT(*) FROM form_submissions WHERE submitted_at >= $1`,
        [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
      ),
    ]);

    const metrics = {
      overall: parseInt(totalRes.rows[0].count, 10) || 0,
      pending: parseInt(pendingRes.rows[0].count, 10) || 0,
      last24Hours: parseInt(recentRes.rows[0].count, 10) || 0,
    };

    const statusCounts: Record<string, number> = {
      pending: metrics.pending,
      processed: Math.max(0, metrics.overall - metrics.pending),
    };

    const { rows: allFormTypeRows } = await query(
      `SELECT DISTINCT form_type FROM form_submissions WHERE form_type IS NOT NULL`,
    );

    const formTypeList = allFormTypeRows
      .map((item) => item.form_type as string | null)
      .filter((value): value is string => Boolean(value));

    const formTypeSummaries = await Promise.all(
      formTypeList.map(async (type) => {
        const [totalForTypeRes, pendingForTypeRes, lastSubmittedRes] =
          await Promise.all([
            query(
              `SELECT COUNT(*) FROM form_submissions WHERE form_type = $1`,
              [type],
            ),
            query(
              `SELECT COUNT(*) FROM form_submissions
               WHERE form_type = $1 AND (status IS NULL OR status = 'pending')`,
              [type],
            ),
            query(
              `SELECT submitted_at FROM form_submissions
               WHERE form_type = $1
               ORDER BY submitted_at DESC LIMIT 1`,
              [type],
            ),
          ]);

        return {
          formType: type,
          total: parseInt(totalForTypeRes.rows[0].count, 10) || 0,
          pending: parseInt(pendingForTypeRes.rows[0].count, 10) || 0,
          lastSubmittedAt: lastSubmittedRes.rows[0]?.submitted_at ?? null,
        };
      })
    );

    const rawSubmissions =
      data as Database["public"]["Tables"]["form_submissions"]["Row"][];

    const submissions: FormSubmissionWithAssets[] = rawSubmissions.map(
      (submission) => {
        const images = imagesBySubmission.get(submission.id) ?? [];
        const thumbnail = images.find((img) => img.variant === "thumb");

        return {
          ...submission,
          images,
          attachmentsCount: images.length,
          thumbnailUrl: thumbnail?.public_url ?? null,
        };
      }
    );

    return NextResponse.json({
      success: true,
      submissions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      formTypes: formTypeList,
      statusCounts,
      metrics,
      typeBreakdown: formTypeSummaries,
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authStatus });
    }
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// UPDATE form submission status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    await requireStaff(request);

    const body = await request.json();
    const { id, status, reviewer_notes } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      );
    }

    const { rows } = await query(
      `UPDATE form_submissions
       SET status = $1, reviewed_at = $2, reviewer_notes = COALESCE($3, reviewer_notes)
       WHERE id = $4
       RETURNING *`,
      [status, new Date().toISOString(), reviewer_notes ?? null, id],
    );
    const data = rows[0] as
      | Database["public"]["Tables"]["form_submissions"]["Row"]
      | undefined;

    if (!data) {
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
    }

    // Award XP for "suggest_place" if approved/processed
    // This connects the "Suggest New Place" activity
    const additionalData = data.additional_data as Record<string, unknown> | null;
    const userId = typeof additionalData?.user_id === "string" ? additionalData.user_id : null;

    if (
      (data.status === "approved" || data.status === "processed") &&
      data.form_type === "get-listed" &&
      userId // Only if we captured the user ID
    ) {
      try {
        const { awardXP } = await import("@/lib/gamification");
        await awardXP(userId, "suggest_place", data.id);
      } catch (xpError) {
        console.error("Failed to award XP for suggest_place:", xpError);
      }
    }

    // Award XP for "report_info" if approved/processed
    if (
      (data.status === "approved" || data.status === "processed") &&
      (data.form_type === "listing_report" || data.form_type === "event_report") &&
      userId
    ) {
      try {
        const { awardXP } = await import("@/lib/gamification");
        // Use form ID as related ID
        await awardXP(userId, "report_info", data.id);
      } catch (xpError) {
        console.error("Failed to award XP for report_info:", xpError);
      }
    }

    return NextResponse.json({
      success: true,
      submission: data,
      message: "Submission updated successfully",
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authStatus });
    }
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
