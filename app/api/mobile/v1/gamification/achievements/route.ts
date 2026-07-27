import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/gamification/achievements
 *
 * All defined badges (ordered by their points threshold), each annotated with
 * whether the caller has earned it and when. Backed by the existing
 * `badges`/`user_badges` tables - already seeded, just never exposed by any
 * API (web or mobile) before this route.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  let badgeRows;
  let earnedRows;
  try {
    const [badgesRes, earnedRes] = await Promise.all([
      query(
        `SELECT id, name, description, icon_url, min_points_required
         FROM badges
         ORDER BY min_points_required ASC NULLS LAST, id ASC`,
      ),
      query(
        `SELECT badge_id, to_json(awarded_at) #>> '{}' AS awarded_at
         FROM user_badges
         WHERE user_id = $1`,
        [user.id],
      ),
    ]);
    badgeRows = badgesRes.rows;
    earnedRows = earnedRes.rows;
  } catch (error) {
    console.error(
      "[mobile-api] achievements query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load achievements.", 500);
  }

  const earnedByBadge = new Map<number, string>(
    earnedRows.map((r) => [Number(r.badge_id), r.awarded_at as string]),
  );

  const achievements = badgeRows.map((b) => {
    const badgeId = Number(b.id);
    const earnedAt = earnedByBadge.get(badgeId) ?? null;
    return {
      id: badgeId,
      name: b.name,
      description: b.description,
      icon_url: b.icon_url,
      min_points_required: b.min_points_required,
      earned: earnedAt != null,
      earned_at: earnedAt,
    };
  });

  return ok({ achievements });
});
