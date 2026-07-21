import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/gamification/challenges
 *
 * Active weekly challenges (currently within their start/end window) with the
 * caller's progress. Auth required. Mirrors `app/api/gamification/challenges`
 * (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const now = new Date().toISOString();
  let list;
  try {
    const { rows } = await query(
      `SELECT id, title, description, challenge_type, xp_reward, target_count, start_date, end_date
       FROM weekly_challenges
       WHERE is_active = true AND start_date <= $1 AND end_date >= $1
       ORDER BY start_date DESC`,
      [now],
    );
    list = rows;
  } catch (error) {
    console.error(
      "[mobile-api] challenges query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load challenges.",
      500,
    );
  }
  if (list.length === 0) return ok({ challenges: [] });

  const ids = list.map((c) => c.id);
  const { rows: progressRows } = await query(
    `SELECT challenge_id, current_progress, completed
     FROM user_challenge_progress
     WHERE user_id = $1 AND challenge_id = ANY($2::bigint[])`,
    [user.id, ids],
  );

  const nowMs = Date.now();
  const challengesOut = list.map((c) => {
    const progress = progressRows.find((p) => p.challenge_id === c.id);
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(c.end_date).getTime() - nowMs) / (1000 * 60 * 60 * 24),
      ),
    );
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      challenge_type: c.challenge_type,
      xp_reward: c.xp_reward,
      target_count: c.target_count,
      start_date: c.start_date,
      end_date: c.end_date,
      current_progress: progress?.current_progress ?? 0,
      is_completed: progress?.completed ?? false,
      days_remaining: daysRemaining,
    };
  });

  return ok({ challenges: challengesOut });
});
