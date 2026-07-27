/**
 * GET /api/gamification/leaderboard?period=all_time&limit=100
 * Fetch user rankings with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

type LeaderboardPeriod = "all_time" | "weekly" | "monthly";

/**
 * Validate and return period filter
 */
function validatePeriod(period: string | null): LeaderboardPeriod {
  const valid: LeaderboardPeriod[] = ["all_time", "weekly", "monthly"];
  if (valid.includes(period as LeaderboardPeriod)) {
    return period as LeaderboardPeriod;
  }
  return "all_time";
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Parse query parameters
    const periodParam = request.nextUrl.searchParams.get("period");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const offsetParam = request.nextUrl.searchParams.get("offset");

    const period = validatePeriod(periodParam);
    const limit = Math.min(parseInt(limitParam || "100"), 1000); // Cap at 1000
    const offset = parseInt(offsetParam || "0");

    // Query leaderboard_cache for the given period
    let leaderboard;
    try {
      const { rows } = await query(
        `SELECT
           lc.rank_position, lc.user_id, lc.xp_total, lc.rank_name,
           to_json(lc.cached_at) #>> '{}' AS cached_at,
           p.id AS profile_id, p.username, p.avatar_url
         FROM public.leaderboard_cache lc
         LEFT JOIN public.profiles p ON p.id = lc.user_id
         WHERE lc.period_type = $1
         ORDER BY lc.rank_position ASC
         LIMIT $2 OFFSET $3`,
        [period, limit, offset],
      );
      leaderboard = rows;
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to fetch leaderboard",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }

    // Map nested profiles to flat structure
    const mappedLeaderboard = (leaderboard || []).map((entry) => ({
      rank_position: entry.rank_position,
      user_id: entry.user_id,
      xp_total: entry.xp_total,
      rank_name: entry.rank_name,
      cached_at: entry.cached_at,
      username: entry.username || null,
      avatar_url: entry.avatar_url || null,
    }));

    // Get current user info if authenticated
    let userRank = null;

    const { rows: userRankRows } = await query(
      `SELECT rank_position, xp_total
       FROM public.leaderboard_cache
       WHERE period_type = $1 AND user_id = $2
       LIMIT 1`,
      [period, session.userId],
    );
    userRank = userRankRows[0] || null;

    // Real total row count for the period (not the page size) so the client's
    // pagination renders beyond page 1.
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS count FROM public.leaderboard_cache WHERE period_type = $1`,
      [period],
    );
    const totalCount = countRows[0] ? Number(countRows[0].count) : null;

    return NextResponse.json({
      leaderboard: mappedLeaderboard,
      period,
      limit,
      offset,
      total_count: totalCount ?? mappedLeaderboard.length,
      user_rank: userRank,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
