import React, { Suspense } from "react";
import { PremiumFavoritesGrid } from "@/components/dashboard/PremiumFavoritesGrid";
import { FavoritesHydrator } from "@/components/dashboard/FavoritesHydrator";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type FavoriteListing =
  Database["public"]["Views"]["listings_with_details"]["Row"] & {
    favorited_at: string;
  };

export default async function FavoritesPage() {
  const { user } = await requireSessionUser({ withProfile: false });

  let favoriteListings: FavoriteListing[] = [];
  try {
    const { rows: favRows } = await query(
      `SELECT listing_id, created_at FROM favorite_listings
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id],
    );

    if (favRows.length > 0) {
      const orderedIds = favRows.map((f) => Number(f.listing_id));
      const favoritedAtById = new Map(
        favRows.map((f) => [Number(f.listing_id), f.created_at]),
      );

      const { rows: listingRows } = await query(
        `SELECT * FROM listings_with_details WHERE id = ANY($1::bigint[])`,
        [orderedIds],
      );

      const listingIds = listingRows.map((r) => Number(r.id));
      const imagesByListing: Record<number, unknown[]> = {};
      if (listingIds.length > 0) {
        const { rows: imageRows } = await query(
          `SELECT id, listing_id, url, alt_text, is_primary, display_order
           FROM listing_images WHERE listing_id = ANY($1::bigint[])
           ORDER BY display_order ASC`,
          [listingIds],
        );
        for (const img of imageRows) {
          const listingId = Number(img.listing_id);
          (imagesByListing[listingId] ??= []).push(img);
        }
      }

      const byId = new Map(listingRows.map((r) => [Number(r.id), r]));
      favoriteListings = orderedIds
        .map((id) => {
          const listing = byId.get(id);
          if (!listing) return null;
          return {
            ...listing,
            listing_images: imagesByListing[id] ?? [],
            favorited_at: favoritedAtById.get(id),
          } as unknown as FavoriteListing;
        })
        .filter((r): r is FavoriteListing => r !== null);
    }
  } catch (error) {
    console.error("Failed to load favorites:", error);
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
