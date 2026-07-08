import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
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
 * each). All three reads use the caller's RLS client with an explicit
 * `inviter_id`/`user_id` filter. XP is summed from `points_log` by award reason
 * so the totals agree with the website dashboard. Mirrors
 * `app/api/invitations/stats`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const [invitations, shares, xpLogs] = await Promise.all([
    supabase
      .from("invitations")
      .select("status")
      .eq("inviter_id", user.id)
      .returns<InvitationStatusRow[]>(),
    supabase
      .from("social_shares")
      .select("verification_status")
      .eq("user_id", user.id)
      .returns<ShareStatusRow[]>(),
    supabase
      .from("points_log")
      .select("points, reason")
      .eq("user_id", user.id)
      .or("reason.ilike.%invitation%,reason.ilike.%share%")
      .returns<PointsLogRow[]>(),
  ]);

  if (invitations.error || shares.error || xpLogs.error) {
    console.error(
      "[mobile-api] invite stats failed:",
      invitations.error?.message ??
        shares.error?.message ??
        xpLogs.error?.message,
    );
    throw new MobileApiError("internal_error", "Failed to load stats.", 500);
  }

  return ok(
    buildInviteShareStats(
      invitations.data ?? [],
      shares.data ?? [],
      xpLogs.data ?? [],
    ),
  );
});
