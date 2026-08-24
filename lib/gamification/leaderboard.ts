import { query } from "@/lib/db";

const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Recomputes leaderboard_cache (all_time/weekly/monthly) via the DB-side
 * refresh_leaderboard_cache() function if it hasn't been refreshed
 * recently. Called from the leaderboard read routes instead of a cron job -
 * whichever request finds the cache stale pays the recompute cost, so
 * "This Month" rolls over on its own the first time someone checks the
 * leaderboard after the 1st, and all_time/weekly stay current too.
 */
export async function ensureLeaderboardFresh(): Promise<void> {
  try {
    const { rows } = await query(
      `SELECT MAX(cached_at) AS cached_at FROM leaderboard_cache`,
    );
    const cachedAt = rows[0]?.cached_at ? new Date(rows[0].cached_at) : null;
    const isStale = !cachedAt || Date.now() - cachedAt.getTime() > STALE_AFTER_MS;
    if (isStale) {
      await query(`SELECT refresh_leaderboard_cache()`);
    }
  } catch (error) {
    console.error(
      "[leaderboard] refresh_leaderboard_cache failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
