import { query } from "@/lib/db";

/**
 * Whether a profile has been self-deleted (anonymized). JWTs have no
 * server-side revocation list, so this is the chokepoint that makes
 * deletion take effect immediately on the next request instead of only
 * once the 7-day token naturally expires.
 */
export async function isAccountDeleted(userId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT deleted_at FROM public.profiles WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return Boolean(rows[0]?.deleted_at);
}
