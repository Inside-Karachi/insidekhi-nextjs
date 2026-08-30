import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { getFriendlyActivityName } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * One entry in the app's Activity feed. Shape is fixed by the RN client
 * (`ActivityFeedItem` in insidekhi-reactnative/src/types/api.ts) — keep in sync.
 */
type ActivityFeedType =
  | "booking"
  | "checkin"
  | "review"
  | "review_helpful"
  | "favourite"
  | "badge"
  | "rank_up"
  | "streak"
  | "deal"
  | "referral"
  | "xp";

type ActivityFeedItem = {
  id: string;
  type: ActivityFeedType;
  title: string;
  subtitle: string | null;
  href: string | null;
  xp: number | null;
  occurred_at: string;
};

type PointsLogRow = {
  id: string | number;
  points: string | number | null;
  reason: string | null;
  related_id: string | number | null;
  created_at: string;
  total_count?: string | number;
};

/**
 * Per-slug feed metadata. `title` overrides `getFriendlyActivityName` where a
 * warmer sentence reads better; anything not listed falls back to that helper
 * and a generic `xp` type.
 */
const SLUG_META: Record<string, { type: ActivityFeedType; title?: string }> = {
  leave_review: { type: "review", title: "Wrote a review" },
  react_review: { type: "review_helpful", title: "Reacted to a review" },
  check_in: { type: "checkin", title: "Checked in" },
  visit_location: { type: "checkin", title: "Visited a location" },
  daily_login: { type: "streak", title: "Claimed a daily login reward" },
  refer_friend: { type: "referral", title: "Referred a friend" },
  share_listing: { type: "xp", title: "Shared a listing" },
  complete_profile: { type: "xp", title: "Completed your profile" },
};

function toItem(row: PointsLogRow): ActivityFeedItem {
  const slug = row.reason ?? "";
  const meta = SLUG_META[slug];
  const points = Number(row.points);

  return {
    id: `points_log:${row.id}`,
    type: meta?.type ?? "xp",
    title: meta?.title ?? getFriendlyActivityName(slug),
    subtitle: null,
    href: null,
    // Only surface positive awards — the client renders this as a "+N" pill, and
    // negative rows (moderation clawbacks) shouldn't read as an achievement.
    xp: Number.isFinite(points) && points > 0 ? points : null,
    occurred_at: row.created_at,
  };
}

/**
 * GET /api/mobile/v1/activity?page=&limit=
 *
 * The caller's own activity feed, newest first. Phase 1 is backed solely by
 * `public.points_log` (already a chronological, XP-annotated log of logins,
 * reviews, check-ins, shares, referrals, …). A later pass unions in bookings /
 * favourites / badges for richer rows and tap targets.
 *
 * One statement + a fallback count for the empty page, mirroring
 * `app/api/mobile/v1/favorites/list/route.ts` — the prod pool is capped at one
 * connection per instance, so parallel `query()` calls must be avoided.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  let rows: PointsLogRow[];
  try {
    const res = await query(
      `SELECT id, points, reason, related_id,
              to_json(created_at) #>> '{}' AS created_at,
              COUNT(*) OVER () AS total_count
       FROM public.points_log
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset],
    );
    rows = res.rows as PointsLogRow[];
  } catch (error) {
    console.error(
      "[mobile-api] activity feed query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load your activity.",
      500,
    );
  }

  // `COUNT(*) OVER ()` only rides along on returned rows, so an empty page
  // (no history, or an offset past the end) needs its own total lookup.
  let total: number;
  if (rows.length > 0) {
    total = Number(rows[0].total_count ?? 0);
  } else {
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM public.points_log WHERE user_id = $1`,
      [user.id],
    );
    total = Number(countRows[0]?.count ?? 0);
  }

  return ok(rows.map(toItem), {
    pagination: buildPaginationMeta(page, limit, total),
  });
});
