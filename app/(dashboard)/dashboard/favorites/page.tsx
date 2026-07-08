import React, { Suspense } from "react";
import { PremiumFavoritesGrid } from "@/components/dashboard/PremiumFavoritesGrid";
import { FavoritesHydrator } from "@/components/dashboard/FavoritesHydrator";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/auth/require-session";
import { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type FavoriteListing =
  Database["public"]["Views"]["listings_with_details"]["Row"] & {
    favorited_at: string;
  };

export default async function FavoritesPage() {
  const { user } = await requireSessionUser({ withProfile: false });
  const supabase = await createServerSupabase({ useServiceRole: true });

  const { data: favorites, error } = await supabase
    .from("favorite_listings")
    .select(
      `created_at, listings:listings_with_details!inner(*, listing_images!fkey_listing_images_listing_id(url, alt_text, is_primary, display_order))`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let favoriteListings: FavoriteListing[] = [];
  if (error) {
    console.error("Failed to load favorites:", error);
  } else {
    favoriteListings =
      favorites?.map((fav) => ({
        ...fav.listings,
        favorited_at: fav.created_at,
      })) || [];
  }

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      }
    >
      <FavoritesHydrator favorites={favoriteListings} />
      <PremiumFavoritesGrid />
    </Suspense>
  );
}
