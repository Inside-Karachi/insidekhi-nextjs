/**
 * Shared helpers for the mobile invitations & shares endpoints (section 12).
 *
 * Writes (create share / create invitation / accept invitation) go through
 * SECURITY DEFINER RPCs whose EXECUTE is granted to `service_role` only, so the
 * routes invoke them with `createMobileServiceClient` passing the explicit caller
 * id. Reads (pending invitations / stats) use the caller's RLS-scoped client and
 * ALSO filter explicitly by `inviter_id`/`user_id` - the SELECT policies admit
 * admin/lister/invitee rows, so we never rely on RLS alone to scope to "mine".
 */
import type { Database } from "@/types/database";
import { getClientIp } from "./forms";

/**
 * A client IP suitable for an `inet` RPC param, or null. `getClientIp` returns
 * `"unknown"` when no proxy header is present, and a forged `x-forwarded-for`
 * could otherwise carry junk that fails the `inet` cast and 500s the RPC - so we
 * only return a value that is a well-formed IPv4 or IPv6 address, else null. The
 * IP only drives optional same-IP anti-spam flagging, so dropping a malformed
 * one is harmless.
 */
const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Permissive IPv6: hex groups separated by colons, with optional `::` and an
// optional embedded IPv4 tail. Requires at least one `:` so it can't match bare
// junk; Postgres makes the final validity call.
const IPV6 = /^(?=.*:)[0-9a-fA-F:]+(\.\d{1,3}){0,3}$/;
export function clientInet(request: Request): string | null {
  const ip = getClientIp(request);
  if (ip === "unknown") return null;
  return IPV4.test(ip) || IPV6.test(ip) ? ip : null;
}

// ---------------------------------------------------------------------------
// Pending invitations
// ---------------------------------------------------------------------------

/**
 * Public DTO for one of the caller's own pending sent invitations. Redacted:
 * no UUIDs (inviter_id/invitee_id), no `invite_token` (the accept secret), no
 * IPs, no internal XP-award flags.
 */
export type PendingInvitationDTO = {
  invite_code: string;
  invitee_email: string;
  status: string;
  created_at: string | null;
  expires_at: string | null;
};

export const PENDING_INVITATION_COLUMNS =
  "invite_code, invitee_email, status, created_at, expired_at";

export type PendingInvitationRow = Pick<
  Database["public"]["Tables"]["invitations"]["Row"],
  "invite_code" | "invitee_email" | "status" | "created_at" | "expired_at"
>;

export function toPendingInvitation(
  row: PendingInvitationRow,
): PendingInvitationDTO {
  return {
    invite_code: row.invite_code,
    invitee_email: row.invitee_email,
    status: row.status,
    created_at: row.created_at,
    expires_at: row.expired_at,
  };
}

// ---------------------------------------------------------------------------
// Invite + share stats
// ---------------------------------------------------------------------------

export type InvitationStatusRow = Pick<
  Database["public"]["Tables"]["invitations"]["Row"],
  "status"
>;
export type ShareStatusRow = Pick<
  Database["public"]["Tables"]["social_shares"]["Row"],
  "verification_status"
>;
export type PointsLogRow = Pick<
  Database["public"]["Tables"]["points_log"]["Row"],
  "points" | "reason"
>;

/** Aggregated invite + share counters for the caller. */
export type InviteShareStatsDTO = {
  total_invitations_sent: number;
  total_invitations_accepted: number;
  pending_invitations: number;
  total_shares_created: number;
  total_shares_verified: number;
  total_shares_rejected: number;
  pending_shares: number;
  total_xp_from_invites: number;
  total_xp_from_shares: number;
};

/**
 * Computes the invite/share counters from the caller's own rows. XP is summed
 * from `points_log` by matching the award `reason` (mirrors the website's
 * `app/api/invitations/stats` so the numbers agree with the web dashboard).
 */
export function buildInviteShareStats(
  invitations: ReadonlyArray<InvitationStatusRow>,
  shares: ReadonlyArray<ShareStatusRow>,
  xpLogs: ReadonlyArray<PointsLogRow>,
): InviteShareStatsDTO {
  return {
    total_invitations_sent: invitations.length,
    total_invitations_accepted: invitations.filter(
      (i) => i.status === "accepted",
    ).length,
    pending_invitations: invitations.filter((i) => i.status === "pending")
      .length,
    total_shares_created: shares.length,
    total_shares_verified: shares.filter(
      (s) => s.verification_status === "verified",
    ).length,
    total_shares_rejected: shares.filter(
      (s) => s.verification_status === "rejected",
    ).length,
    pending_shares: shares.filter((s) => s.verification_status === "pending")
      .length,
    total_xp_from_invites: xpLogs
      .filter((l) => (l.reason ?? "").toLowerCase().includes("invitation"))
      .reduce((sum, l) => sum + (l.points ?? 0), 0),
    total_xp_from_shares: xpLogs
      .filter((l) => (l.reason ?? "").toLowerCase().includes("share"))
      .reduce((sum, l) => sum + (l.points ?? 0), 0),
  };
}
