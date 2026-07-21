import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

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

  const { user } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  let rows;
  try {
    const result = await query(
      `SELECT lc.rank_position, lc.user_id, lc.xp_total, lc.rank_name,
              p.username, p.avatar_url
       FROM leaderboard_cache lc
       LEFT JOIN profiles p ON p.id = lc.user_id
       WHERE lc.period_type = $1
       ORDER BY lc.rank_position ASC
       LIMIT $2 OFFSET $3`,
      [period, limit, offset],
    );
    rows = result.rows;
  } catch (error) {
    console.error(
      "[mobile-api] leaderboard query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load leaderboard.",
      500,
    );
  }

  let count: number | null = null;
  try {
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS count FROM leaderboard_cache WHERE period_type = $1`,
      [period],
    );
    count = countRows[0] ? Number(countRows[0].count) : null;
  } catch (countError) {
    console.error(
      "[mobile-api] leaderboard count failed:",
      countError instanceof Error ? countError.message : countError,
    );
  }

  const leaderboard = rows.map((r) => ({
    rank_position: r.rank_position,
    is_own: currentUserId != null && r.user_id === currentUserId,
    xp_total: r.xp_total,
    rank_name: r.rank_name,
    username: r.username ?? null,
    avatar_url: r.avatar_url ?? null,
  }));

  let userRank: {
    rank_position: number | null;
    xp_total: number | null;
  } | null = null;
  if (currentUserId) {
    const { rows: urRows } = await query(
      `SELECT rank_position, xp_total
       FROM leaderboard_cache
       WHERE period_type = $1 AND user_id = $2
       LIMIT 1`,
      [period, currentUserId],
    );
    userRank = urRows[0] ?? null;
  }

  return ok(
    { leaderboard, user_rank: userRank },
    { period, limit, offset, total_count: count ?? leaderboard.length },
  );
});
