import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  buildInviteShareStats,
  type InvitationStatusRow,
  type ShareStatusRow,
  type PointsLogRow,
} from "@/lib/mobile/invites";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/invitations/stats
 *
 * Aggregated invite + share counters for the caller (sent/accepted/pending
 * invitations, created/verified/rejected/pending shares, and XP earned from
 * each). All three reads are scoped by an explicit `inviter_id`/`user_id`
 * filter. XP is summed from `points_log` by award reason so the totals agree
 * with the website dashboard. Mirrors `app/api/invitations/stats`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  let invitations: InvitationStatusRow[];
  let shares: ShareStatusRow[];
  let xpLogs: PointsLogRow[];
  try {
    const [invitationsRes, sharesRes, xpRes] = await Promise.all([
      query(`SELECT status FROM invitations WHERE inviter_id = $1`, [
        user.id,
      ]),
      query(
        `SELECT verification_status FROM social_shares WHERE user_id = $1`,
        [user.id],
      ),
      query(
        `SELECT points, reason FROM points_log
         WHERE user_id = $1 AND (reason ILIKE '%invitation%' OR reason ILIKE '%share%')`,
        [user.id],
      ),
    ]);
    invitations = invitationsRes.rows as unknown as InvitationStatusRow[];
    shares = sharesRes.rows as unknown as ShareStatusRow[];
    xpLogs = xpRes.rows as unknown as PointsLogRow[];
  } catch (error) {
    console.error("[mobile-api] invite stats failed:", error);
    throw new MobileApiError("internal_error", "Failed to load stats.", 500);
  }

  return ok(buildInviteShareStats(invitations, shares, xpLogs));
});
