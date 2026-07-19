import React, { Suspense } from "react";
import { PremiumFavoritesGrid } from "@/components/dashboard/PremiumFavoritesGrid";
import { FavoritesHydrator } from "@/components/dashboard/FavoritesHydrator";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { Database } from "@/types/supabase";
import { FavoriteListing } from "@/types/favorites.types";

export const dynamic = "force-dynamic";

type ListingRow = Database["public"]["Views"]["listings_with_details"]["Row"];
type ListingImage = NonNullable<FavoriteListing["images"]>[number];

export default async function FavoritesPage() {
  const { user } = await requireSessionUser({ withProfile: false });

  let favoriteListings: FavoriteListing[] = [];
  try {
    const { rows: favRows } = await query(
      `SELECT listing_id, created_at FROM favorite_listings
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id],
    );

    const orderedIds = favRows.map((r) => Number(r.listing_id));
    const favoritedAtById = new Map<number, string>(
      favRows.map((r) => [Number(r.listing_id), r.created_at as string]),
    );

    if (orderedIds.length > 0) {
      const { rows: listingRows } = await query(
        `SELECT * FROM listings_with_details WHERE id = ANY($1::bigint[])`,
        [orderedIds],
      );

      const imagesByListing: Record<number, ListingImage[]> = {};
      const { rows: imageRows } = await query(
        `SELECT id, listing_id, url, alt_text, display_order, is_primary, created_at, updated_at
         FROM listing_images
         WHERE listing_id = ANY($1::bigint[])
         ORDER BY display_order ASC`,
        [orderedIds],
      );
      for (const img of imageRows) {
        const listingId = Number(img.listing_id);
        (imagesByListing[listingId] ??= []).push(img as ListingImage);
      }

      const byId = new Map<number, ListingRow>(
        listingRows.map((r) => [Number((r as ListingRow).id), r as ListingRow]),
      );

      favoriteListings = orderedIds
        .map((id) => byId.get(id))
        .filter((r): r is ListingRow => r != null)
        .map((r) => ({
          ...r,
          favorited_at: favoritedAtById.get(Number(r.id))!,
          images: imagesByListing[Number(r.id)] ?? [],
        }));
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
