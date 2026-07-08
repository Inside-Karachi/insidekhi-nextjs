import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Given a server Supabase client (created via createServerSupabase without service role)
 * and an array of listing IDs, return a Set containing listing IDs the current
 * authenticated user has favorited. Returns an empty Set for unauthenticated users.
 */
export async function getFavoritedListingIdsForUser(
  supabase: SupabaseClient,
  listingIds: number[]
): Promise<Set<number>> {
  if (!listingIds || listingIds.length === 0) return new Set();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabase
      .from("favorite_listings")
      .select("listing_id")
      .in("listing_id", listingIds)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching user favorites", error.message || error);
      return new Set();
    }

    const set = new Set<number>();
    if (Array.isArray(data)) {
      for (const row of data) {
        if (row && typeof row.listing_id === "number") set.add(row.listing_id);
      }
    }

    return set;
  } catch (err) {
    console.error("getFavoritedListingIdsForUser error", err);
    return new Set();
  }
}

export default getFavoritedListingIdsForUser;
