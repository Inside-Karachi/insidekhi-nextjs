import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";
import {
  toListingCard,
  toListingImage,
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const LISTING_CARD_SQL_COLUMNS =
  "id, name, slug, description, address, category_id, category_name, latitude, longitude, avg_rating, review_count, is_featured, status, menu_pdf_url, google_maps_url";

function toNumericListingRow(row: Record<string, unknown>): ListingRowLike {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
  } as unknown as ListingRowLike;
}

/**
 * GET /api/mobile/v1/user/recommendations?limit=
 *
 * Personalized "Recommended For You" listings for the home screen. When the
 * caller has an active saved location, results are ranked by proximity to it
 * (via `get_nearby_listings`) with favorite-category matches bubbled to the
 * top. Otherwise falls back to featured/top-rated published listings. Returns
 * the same `ListingCard[]` shape as GET /listings so the client renders it
 * unchanged. Mirrors the website dashboard's recommendation logic.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 20
    ? limitRaw
    : 6;

  // Active saved location + favorite categories drive the ranking.
  const [{ rows: activeRows }, { rows: favRows }] = await Promise.all([
    query(
      `SELECT latitude, longitude FROM public.user_saved_locations
       WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [user.id],
    ),
    query(
      `SELECT DISTINCT l.category_id
       FROM favorite_listings fl
       JOIN listings l ON fl.listing_id = l.id
       WHERE fl.user_id = $1 AND l.category_id IS NOT NULL
       LIMIT 10`,
      [user.id],
    ),
  ]);

  const active = activeRows[0];
  const favoriteCategories: number[] = favRows
    .map((r) => Number(r.category_id))
    .filter((n) => Number.isInteger(n));

  // Build an ordered list of listing ids.
  let orderedIds: number[] = [];

  if (active) {
    try {
      const { rows: nearby } = await query(
        `SELECT id, category_id, status FROM get_nearby_listings($1, $2, $3, $4)`,
        [active.latitude, active.longitude, 10000, 24],
      );
      const published = nearby.filter((l) => l.status === "published");
      const matched = published.filter((l) =>
        favoriteCategories.includes(Number(l.category_id)),
      );
      const rest = published.filter(
        (l) => !favoriteCategories.includes(Number(l.category_id)),
      );
      orderedIds = [...matched, ...rest].map((l) => Number(l.id)).slice(0, limit);
    } catch (error) {
      console.error("[mobile-api] nearby recommendations failed:", error);
    }
  }

  // Fallback: favorite-category listings, else featured/top-rated.
  if (orderedIds.length === 0) {
    const { rows } =
      favoriteCategories.length > 0
        ? await query(
            `SELECT id FROM listings_with_details
             WHERE status = 'published' AND category_id = ANY($1::int[])
             ORDER BY is_featured DESC NULLS LAST, avg_rating DESC NULLS LAST, id ASC
             LIMIT $2`,
            [favoriteCategories, limit],
          )
        : await query(
            `SELECT id FROM listings_with_details
             WHERE status = 'published'
             ORDER BY is_featured DESC NULLS LAST, avg_rating DESC NULLS LAST, id ASC
             LIMIT $1`,
            [limit],
          );
    orderedIds = rows.map((r) => Number(r.id));
  }

  if (orderedIds.length === 0) return ok([]);

  // Fetch full card rows + images for the chosen ids, preserving rank order.
  const { rows: cardRows } = await query(
    `SELECT ${LISTING_CARD_SQL_COLUMNS} FROM listings_with_details
     WHERE id = ANY($1::int[])`,
    [orderedIds],
  );
  const byId = new Map<number, ListingRowLike>();
  for (const row of cardRows) {
    const normalized = toNumericListingRow(row);
    byId.set(normalized.id as number, normalized);
  }

  const imagesByListing: Record<number, ListingImageDTO[]> = {};
  const { rows: images } = await query(
    `SELECT id, listing_id, url, alt_text, display_order, is_primary
     FROM listing_images
     WHERE listing_id = ANY($1::int[])
     ORDER BY display_order ASC`,
    [orderedIds],
  );
  for (const img of images) {
    (imagesByListing[img.listing_id] ??= []).push(toListingImage(img));
  }

  const listings = orderedIds
    .map((id) => byId.get(id))
    .filter((r): r is ListingRowLike => r !== undefined)
    .map((r) => toListingCard(r, imagesByListing[r.id as number] ?? []));

  return ok(listings);
});
