import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  PENDING_INVITATION_COLUMNS,
  toPendingInvitation,
  type PendingInvitationRow,
} from "@/lib/mobile/invites";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/invitations/pending
 *
 * The caller's own still-pending sent invitations, newest first. Uses the
 * caller's RLS client AND an explicit `inviter_id` filter (the SELECT policy
 * also admits invitee/admin rows, so we scope to "mine" in the query, not via
 * RLS alone). DTO is redacted - no UUIDs, token, or IPs. Mirrors
 * `app/api/invitations/pending`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { data, error } = await supabase
    .from("invitations")
    .select(PENDING_INVITATION_COLUMNS)
    .eq("inviter_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<PendingInvitationRow[]>();

  if (error) {
    console.error("[mobile-api] pending invitations failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load invitations.",
      500,
    );
  }

  return ok((data ?? []).map(toPendingInvitation));
});
