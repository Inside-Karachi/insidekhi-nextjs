import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { syncStateManager } from "@/lib/scraper/redis-state-manager";

export async function POST(_request: NextRequest) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Forbidden", message: "Dev reset is disabled in production" },
        { status: 403 },
      );
    }

    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (await syncStateManager.isSyncRunning()) {
      return NextResponse.json(
        {
          error: "Sync running",
          message: "Stop the active sync before resetting dev state.",
        },
        { status: 409 },
      );
    }

    await syncStateManager.clear();

    return NextResponse.json({
      success: true,
      message: "Dev scraper state cleared (active sync, processed IDs, report, config).",
    });
  } catch (error) {
    const resetError = error as Error;
    return NextResponse.json(
      { error: "Internal server error", message: resetError.message },
      { status: 500 },
    );
  }
}
