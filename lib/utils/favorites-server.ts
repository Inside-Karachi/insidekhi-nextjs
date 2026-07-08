import { SupabaseClient } from "@supabase/supabase-js";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

/**
 * Given listing IDs, return those favorited by the current user.
 * Supports JWT session (web login) and Supabase auth as fallback.
 */
export async function getFavoritedListingIdsForUser(
  supabase: SupabaseClient | null,
  listingIds: number[],
  userId?: string | null,
): Promise<Set<number>> {
  if (!listingIds || listingIds.length === 0) return new Set();

  try {
    let resolvedUserId = userId ?? null;

    if (!resolvedUserId) {
      const session = await getSessionFromCookies();
      resolvedUserId = session?.userId ?? null;
    }

    if (!resolvedUserId && supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedUserId = user?.id ?? null;
    }

    if (!resolvedUserId) return new Set();

    const { rows } = await query(
      `SELECT listing_id FROM favorite_listings
       WHERE user_id = $1 AND listing_id = ANY($2)`,
      [resolvedUserId, listingIds],
    );

    const set = new Set<number>();
    for (const row of rows) {
      if (typeof row.listing_id === "number") set.add(row.listing_id);
    }

    return set;
  } catch (err) {
    console.error("getFavoritedListingIdsForUser error", err);
    return new Set();
  }
}

export default getFavoritedListingIdsForUser;
