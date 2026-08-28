import { query } from "@/lib/db";

/**
 * Whether a profile has been self-deleted (anonymized). JWTs have no
 * server-side revocation list, so this is the chokepoint that makes
 * deletion take effect immediately on the next request instead of only
 * once the 7-day token naturally expires.
 *
 * Called on every authenticated request (see session.ts, mobile/auth.ts,
 * admin.ts), so a query failure here (e.g. a migration not yet applied in
 * some environment) must never take down the entire site - fail open
 * (treat as not deleted) and log, rather than letting it throw.
 */
export async function isAccountDeleted(userId: string): Promise<boolean> {
  try {
    const { rows } = await query(
      `SELECT deleted_at FROM public.profiles WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return Boolean(rows[0]?.deleted_at);
  } catch (err) {
    console.error("[account-status] isAccountDeleted check failed (failing open):", err);
    return false;
  }
}
