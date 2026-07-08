
import { createServerSupabase } from "@/lib/supabase/server";
import { FeaturedListingsSection } from "@/components/homepage/FeaturedListingsSection";
import { getFavoritedListingIdsForUser } from "@/lib/utils/favorites-server";
import { Database } from "@/types/supabase";

export async function FeaturedListingsContainer() {
    const publicSupabase = await createServerSupabase({ publicAnon: true });

    const { data: featuredListings } = await publicSupabase
        .from("listings_with_details")
        .select("*")
        .eq("is_featured", true)
        .eq("status", "published")
        .order("display_order", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);

    type ListingRow = Database["public"]["Views"]["listings_with_details"]["Row"];
    type HydratedListing = ListingRow & { favorited?: boolean };
    const listings = (featuredListings || []) as ListingRow[];
    const hydratedListings: HydratedListing[] = listings.map((l) => ({ ...l }));

    const ids = listings.map((l) => l.id).filter(Boolean) as number[];
    if (ids.length > 0) {
        try {
            const userSupabase = await createServerSupabase();
            const favSet = await getFavoritedListingIdsForUser(userSupabase, ids);
            for (const l of hydratedListings) {
                (l as HydratedListing).favorited = favSet.has(l.id as number);
            }
        } catch (err) {
            console.error("Failed to hydrate favorites for homepage", err);
        }
    }

    return <FeaturedListingsSection listings={hydratedListings || []} />;
}
