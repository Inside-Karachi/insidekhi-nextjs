import { getSessionFromCookies } from "@/lib/auth/session";
/**
 * GET /api/gamification/leaderboard?period=all_time&limit=100
 * Fetch user rankings with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    const supabase = await createServerSupabase();

    // Parse query parameters
    const periodParam = request.nextUrl.searchParams.get("period");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const offsetParam = request.nextUrl.searchParams.get("offset");

    const period = validatePeriod(periodParam);
    const limit = Math.min(parseInt(limitParam || "100"), 1000); // Cap at 1000
    const offset = parseInt(offsetParam || "0");

    // Query leaderboard_cache for the given period
    let query = supabase
      .from("leaderboard_cache")
      .select(
        `
        rank_position,
        user_id,
        xp_total,
        rank_name,
        cached_at,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .eq("period_type", period)
      .order("rank_position", { ascending: true });

    // Apply pagination
    if (offset > 0) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.limit(limit);
    }

    const { data: leaderboard, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch leaderboard", details: error.message },
        { status: 500 },
      );
    }

    // Map nested profiles to flat structure
    interface LeaderboardRow {
      rank_position: number;
      user_id: string;
      xp_total: number;
      rank_name: string;
      cached_at: string;
      profiles: {
        id: string;
        username: string | null;
        avatar_url: string | null;
      };
    }

    const mappedLeaderboard = (leaderboard || []).map(
      (entry: LeaderboardRow) => ({
        rank_position: entry.rank_position,
        user_id: entry.user_id,
        xp_total: entry.xp_total,
        rank_name: entry.rank_name,
        cached_at: entry.cached_at,
        username: entry.profiles?.username || null,
        avatar_url: entry.profiles?.avatar_url || null,
      }),
    );

    // Get current user info if authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let userRank = null;

    if (user) {
      const { data: userData } = await supabase
        .from("leaderboard_cache")
        .select("rank_position, xp_total")
        .eq("period_type", period)
        .eq("user_id", session.userId)
        .single();

      userRank = userData || null;
    }

    // Real total row count for the period (not the page size) so the client's
    // pagination renders beyond page 1.
    const { count: totalCount } = await supabase
      .from("leaderboard_cache")
      .select("rank_position", { count: "exact", head: true })
      .eq("period_type", period);

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
