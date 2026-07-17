import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  toPendingInvitation,
  type PendingInvitationRow,
} from "@/lib/mobile/invites";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/invitations/pending
 *
 * The caller's own still-pending sent invitations, newest first, scoped by an
 * explicit `inviter_id` filter. DTO is redacted - no UUIDs, token, or IPs.
 * Mirrors `app/api/invitations/pending`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  let rows: Record<string, unknown>[];
  try {
    const res = await query(
      `SELECT invite_code, invitee_email, status,
         to_json(created_at) #>> '{}' AS created_at,
         to_json(expired_at) #>> '{}' AS expired_at
       FROM invitations
       WHERE inviter_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [user.id],
    );
    rows = res.rows;
  } catch (error) {
    console.error("[mobile-api] pending invitations failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to load invitations.",
      500,
    );
  }

  return ok(
    rows.map((row) => toPendingInvitation(row as unknown as PendingInvitationRow)),
  );
});
