"use client";

import React from "react";
import { PremiumFavoritesGrid } from "@/components/dashboard/PremiumFavoritesGrid";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { Database } from "@/types/supabase";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

type FavoriteListing =
  Database["public"]["Views"]["listings_with_details"]["Row"] & {
    favorited_at: string;
  };

export default function FavoritesPage() {
  const setFavorites = useFavoritesStore((state) => state.setFavorites);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchFavorites() {
      setLoading(true);
      try {
        const supabase = (await import("@/lib/supabase/client")).createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/login";
          return;
        }
        const { data: favorites, error } = await supabase
          .from("favorite_listings")
          .select(
            `created_at, listings:listings_with_details!inner(*, listing_images!fkey_listing_images_listing_id(url, alt_text, is_primary, display_order))`
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) {
          console.error("Failed to load favorites:", error);
          setFavorites([]);
        } else {
          const favoriteListings: FavoriteListing[] =
            favorites?.map((fav) => ({
              ...fav.listings,
              favorited_at: fav.created_at,
            })) || [];
          setFavorites(favoriteListings);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchFavorites();
  }, [setFavorites]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading favorites...
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      }
    >
      <PremiumFavoritesGrid />
    </Suspense>
  );
}
