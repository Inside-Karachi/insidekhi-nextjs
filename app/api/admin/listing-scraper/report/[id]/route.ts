import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getAdminAuthErrorStatus,
  requireSuperAdmin,
} from "@/lib/auth/admin";

interface Params {
  id: string;
}

/**
 * GET SYNC REPORT BY ID
 *
 * @route GET /api/admin/listing-scraper/report/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    await requireSuperAdmin(request);

    const { id } = await params;

    // Fetch full report from database
    let record:
      | {
          id: string;
          report: unknown;
          started_at: string;
          completed_at: string | null;
          status: string;
          errors_count: number | null;
          config: unknown;
        }
      | undefined;

    try {
      const { rows } = await query(
        `SELECT id, report, started_at, completed_at, status, errors_count, config
         FROM listing_sync_history
         WHERE id = $1
         LIMIT 1`,
        [id],
      );
      record = rows[0];
    } catch (error) {
      console.error("[LISTING SCRAPER] Report query error:", error);
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (!record) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const config =
      record.config && typeof record.config === "object"
        ? (record.config as Record<string, unknown>)
        : {};
    const liveErrors = Array.isArray(config.live_errors)
      ? config.live_errors
      : [];

    return NextResponse.json({
      id: record.id,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      status: record.status,
      errorsCount: record.errors_count ?? 0,
      hasDetailedErrors:
        Array.isArray((record.report as { errors?: unknown[] } | null)?.errors) &&
        ((record.report as { errors?: unknown[] }).errors?.length || 0) > 0,
      liveErrors,
      report: record.report,
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: authStatus === 401 ? "Unauthorized" : "Forbidden" },
        { status: authStatus },
      );
    }

    const reportError = error as Error;
    console.error("[LISTING SCRAPER] Report error:", reportError);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
