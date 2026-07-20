/**
 * POST /api/xp/award
 * Core endpoint for awarding XP to users
 * - Validates activity eligibility (cooldowns, daily caps)
 * - Updates user XP in profiles table
 * - Logs to points_log for audit trail
 * - Detects rank-ups and awards badges
 * - REQUIRES service role or admin
 */

import { NextRequest, NextResponse } from "next/server";
import type { XPAwardRequest } from "@/types/gamification.types";
import { awardXP } from "@/lib/gamification";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { canAwardXpForTarget } from "@/lib/auth/gamification-permissions";

/**
 * Main XP award handler
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request
    const body: XPAwardRequest = await request.json();
    const { user_id, activity_slug, related_id } = body;

    if (!user_id || !activity_slug) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, activity_slug" },
        { status: 400 }
      );
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canAwardXpForTarget(profile.role, session.userId, user_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await awardXP(user_id, activity_slug, related_id);

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("XP award error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
