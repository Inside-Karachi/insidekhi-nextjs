import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

const PERIODS = ["all_time", "weekly", "monthly"] as const;
type Period = (typeof PERIODS)[number];

function parsePeriod(value: string | null): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "all_time";
}

function parseIntInRange(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = parseInt(value ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

type ProfileJoin =
  | { username: string | null; avatar_url: string | null }
  | { username: string | null; avatar_url: string | null }[]
  | null;

type LeaderboardRowLike = {
  rank_position: number | null;
  user_id: string | null;
  xp_total: number | null;
  rank_name: string | null;
  profiles: ProfileJoin;
};

/**
 * GET /api/mobile/v1/gamification/leaderboard?period=&limit=&offset=
 *
 * Public, offset-paginated leaderboard. `period` in all_time|weekly|monthly.
 * The reviewer's auth UUID is NEVER emitted - entries expose only
 * username/avatar/rank + a server-computed `is_own`. `meta.total_count` is the
 * real row count for the period (not the page size).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { searchParams } = new URL(request.url);
  const period = parsePeriod(searchParams.get("period"));
  const limit = parseIntInRange(searchParams.get("limit"), 100, 1, 1000);
  const offset = parseIntInRange(searchParams.get("offset"), 0, 0, 1_000_000);

  const { user, supabase } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  const { data, error } = await supabase
    .from("leaderboard_cache")
    .select(
      "rank_position, user_id, xp_total, rank_name, profiles:user_id(username, avatar_url)",
    )
    .eq("period_type", period)
    .order("rank_position", { ascending: true })
    .range(offset, offset + limit - 1)
    .returns<LeaderboardRowLike[]>();
  if (error) {
    console.error("[mobile-api] leaderboard query failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load leaderboard.",
      500,
    );
  }

  const { count, error: countError } = await supabase
    .from("leaderboard_cache")
    .select("rank_position", { count: "exact", head: true })
    .eq("period_type", period);
  if (countError) {
    console.error("[mobile-api] leaderboard count failed:", countError.message);
  }

  const leaderboard = (data ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      rank_position: r.rank_position,
      is_own: currentUserId != null && r.user_id === currentUserId,
      xp_total: r.xp_total,
      rank_name: r.rank_name,
      username: p?.username ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  });

  let userRank: {
    rank_position: number | null;
    xp_total: number | null;
  } | null = null;
  if (currentUserId) {
    const { data: ur } = await supabase
      .from("leaderboard_cache")
      .select("rank_position, xp_total")
      .eq("period_type", period)
      .eq("user_id", currentUserId)
      .maybeSingle();
    userRank = ur ?? null;
  }

  return ok(
    { leaderboard, user_rank: userRank },
    { period, limit, offset, total_count: count ?? leaderboard.length },
  );
});
