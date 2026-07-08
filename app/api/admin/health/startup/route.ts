import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REQUIRED_LISTINGS_COLUMNS = [
  "submitted_at",
  "reviewed_at",
  "reviewed_by",
  "review_notes",
] as const;

function extractMissingColumn(message: string): string | null {
  const match = message.match(/'([^']+)' column of 'listings'/i);
  return match?.[1] ?? null;
}

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
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

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const missingColumns: string[] = [];
    for (const column of REQUIRED_LISTINGS_COLUMNS) {
      const { error } = await adminSupabase
        .from("listings")
        .select(`id, ${column}`)
        .limit(1);

      if (error?.code === "PGRST204") {
        const parsedColumn = extractMissingColumn(error.message);
        missingColumns.push(parsedColumn || column);
      }
    }

    const { count: generalCategoryCount, error: categoryError } =
      await adminSupabase
        .from("notification_categories")
        .select("slug", { count: "exact", head: true })
        .eq("slug", "general");

    const categoryCheck = {
      ok: !categoryError && (generalCategoryCount ?? 0) > 0,
      count: generalCategoryCount ?? 0,
      error: categoryError
        ? {
            message: categoryError.message,
            details: categoryError.details,
            hint: categoryError.hint,
            code: categoryError.code,
          }
        : null,
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
