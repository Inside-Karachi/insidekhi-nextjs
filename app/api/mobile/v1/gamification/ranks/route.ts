import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/gamification/ranks
 *
 * The active rank ladder (ascending by required XP). When authenticated, also
 * returns the caller's current rank + progress to the next. Mirrors
 * `app/api/gamification/ranks` (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await getOptionalMobileUser(request);

  let rankList;
  try {
    const { rows } = await query(
      `SELECT id, name, slug, color, icon_url, min_xp_required, max_slots, benefits, display_order
       FROM ranks
       WHERE is_active = true
       ORDER BY min_xp_required ASC`,
    );
    rankList = rows;
  } catch (error) {
    console.error(
      "[mobile-api] ranks query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load ranks.", 500);
  }

  let userRankInfo: {
    current_rank: (typeof rankList)[number] | null;
    next_rank: (typeof rankList)[number] | null;
    current_xp: number;
    xp_to_next_rank: number;
    progress_percent: number;
  } | null = null;

  if (user) {
    const { rows: profileRows } = await query(
      `SELECT points FROM profiles WHERE id = $1`,
      [user.id],
    );
    const userXP = profileRows[0]?.points ?? 0;

    const { rows: userRankRows } = await query(
      `SELECT rank_id, achieved_at
       FROM user_ranks
       WHERE user_id = $1 AND current_rank = true
       LIMIT 1`,
      [user.id],
    );
    const userRankData = userRankRows[0];

    if (userRankData) {
      const currentRank =
        rankList.find((r) => r.id === userRankData.rank_id) ?? null;
      const nextRank =
        rankList.find((r) => (r.min_xp_required ?? 0) > userXP) ?? null;
      const currentMin = currentRank?.min_xp_required ?? 0;
      userRankInfo = {
        current_rank: currentRank,
        next_rank: nextRank,
        current_xp: userXP,
        xp_to_next_rank: nextRank
          ? Math.max((nextRank.min_xp_required ?? 0) - userXP, 0)
          : 0,
        progress_percent: nextRank
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((userXP - currentMin) /
                    Math.max((nextRank.min_xp_required ?? 0) - currentMin, 1)) *
                    100,
                ),
              ),
            )
          : 100,
      };
    }
  }

  return ok({ ranks: rankList, user_rank_info: userRankInfo });
});
