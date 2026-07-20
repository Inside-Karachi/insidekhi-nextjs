
import { query } from "@/lib/db";
import { FeaturedListingsSection } from "@/components/homepage/FeaturedListingsSection";
import { getFavoritedListingIdsForUser } from "@/lib/utils/favorites-server";
import { Database } from "@/types/supabase";

export async function FeaturedListingsContainer() {
    const { rows: featuredListings } = await query(
        `SELECT * FROM listings_with_details
         WHERE is_featured = true AND status = 'published'
         ORDER BY display_order DESC NULLS LAST, created_at DESC
         LIMIT 6`,
    );

    type ListingRow = Database["public"]["Views"]["listings_with_details"]["Row"];
    type HydratedListing = ListingRow & { favorited?: boolean };
    // node-pg returns bigint columns (id) as strings; normalize to number to
    // match the shape callers/components expect.
    const listings = featuredListings.map((row) => ({
        ...row,
        id: row.id !== null && row.id !== undefined ? Number(row.id) : row.id,
    })) as unknown as ListingRow[];
    const hydratedListings: HydratedListing[] = listings.map((l) => ({ ...l }));

    const ids = listings.map((l) => l.id).filter(Boolean) as number[];
    if (ids.length > 0) {
        try {
            const favSet = await getFavoritedListingIdsForUser(null, ids);
            for (const l of hydratedListings) {
                (l as HydratedListing).favorited = favSet.has(l.id as number);
            }
        } catch (err) {
            console.error("Failed to hydrate favorites for homepage", err);
        }
    }

    return <FeaturedListingsSection listings={hydratedListings || []} />;
}
