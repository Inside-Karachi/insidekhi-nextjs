import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/favorites/list
 *
 * The caller's favorited listings, most-recently favorited first, with
 * nested `images`. Mirrors /api/mobile/v1/favorites/list but returns raw
 * listings_with_details rows (matching the FavoriteListing type) instead of
 * mapped ListingCards, for use by the web favoritesStore.
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { rows: favRows } = await query(
      `SELECT listing_id, created_at FROM favorite_listings
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [session.userId],
    );

    if (favRows.length === 0) {
      return NextResponse.json({ favorites: [] });
    }

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
        `SELECT id, listing_id, url, alt_text, is_primary, display_order, created_at, updated_at
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
    const favorites = orderedIds
      .map((id) => {
        const listing = byId.get(id);
        if (!listing) return null;
        return {
          ...listing,
          images: imagesByListing[id] ?? [],
          favorited_at: favoritedAtById.get(id),
        };
      })
      .filter((r) => r !== null);

    return NextResponse.json({ favorites });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
