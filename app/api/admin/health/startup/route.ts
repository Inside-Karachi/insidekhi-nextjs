import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const REQUIRED_LISTINGS_COLUMNS = [
  "submitted_at",
  "reviewed_at",
  "reviewed_by",
  "review_notes",
] as const;

export async function GET() {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    if (!["lister", "admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    const missingColumns: string[] = [];
    for (const column of REQUIRED_LISTINGS_COLUMNS) {
      try {
        await query(`SELECT id, ${column} FROM public.listings LIMIT 1`);
      } catch (error) {
        // Postgres "undefined_column" error code
        const code = (error as { code?: string })?.code;
        if (code === "42703") {
          missingColumns.push(column);
        }
      }
    }

    let generalCategoryCount = 0;
    let categoryError: { message: string; details: string | null; hint: string | null; code: string | null } | null = null;
    try {
      const { rows } = await query(
        `SELECT COUNT(*)::int AS count FROM public.notification_categories WHERE slug = $1`,
        ["general"]
      );
      generalCategoryCount = (rows[0] as { count: number })?.count ?? 0;
    } catch (error) {
      const err = error as { message?: string; detail?: string; hint?: string; code?: string };
      categoryError = {
        message: err.message ?? "Unknown error",
        details: err.detail ?? null,
        hint: err.hint ?? null,
        code: err.code ?? null,
      };
    }

    const categoryCheck = {
      ok: !categoryError && generalCategoryCount > 0,
      count: generalCategoryCount,
      error: categoryError,
    };

    const listingsColumnsCheck = {
      ok: missingColumns.length === 0,
      missing: Array.from(new Set(missingColumns)),
      required: [...REQUIRED_LISTINGS_COLUMNS],
    };

    const overallOk = listingsColumnsCheck.ok && categoryCheck.ok;

    return NextResponse.json(
      {
        success: true,
        data: {
          ok: overallOk,
          checks: {
            listingsColumns: listingsColumnsCheck,
            notificationCategoryGeneral: categoryCheck,
          },
          checkedAt: new Date().toISOString(),
        },
      },
      { status: overallOk ? 200 : 503 },
    );
  } catch (error) {
    console.error("[GET /api/admin/health/startup] Health check failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
