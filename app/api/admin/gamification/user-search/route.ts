import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";
import type { UserRole } from "@/types/auth.types";

/**
 * GET /api/admin/gamification/user-search?q=<term>
 * Search users by name/username for the manual XP award admin tool.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = profileRows[0] as { role: UserRole } | undefined;

    if (!profile || !isGamificationOperatorRole(profile.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    if (!q) {
      return NextResponse.json({ success: true, users: [] });
    }

    const { rows: users } = await query(
      `SELECT id, full_name, points
       FROM public.profiles
       WHERE full_name ILIKE $1 OR username ILIKE $1
       LIMIT 10`,
      [`%${q}%`],
    );

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
