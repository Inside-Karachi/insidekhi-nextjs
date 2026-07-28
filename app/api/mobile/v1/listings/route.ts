import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  toListingCard,
  toListingImage,
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { sortFetchedListingsBySearchRelevance } from "@/lib/listings/search-relevance";

/** Explicit column list for `listings_with_details` - never use `*`. */
const LISTING_CARD_SQL_COLUMNS =
  "id, name, slug, description, address, category_id, category_name, latitude, longitude, avg_rating, review_count, is_featured, status, menu_pdf_url, google_maps_url";

/** `id`/`category_id`/etc come back as strings from pg for bigint columns - convert before use. */
function toNumericListingRow(row: Record<string, unknown>): ListingRowLike {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
  } as unknown as ListingRowLike;
}

export const dynamic = "force-dynamic";

/** Sorts supported in this version. Deal/distance-ranked sorts are not yet wired. */
const SUPPORTED_SORTS = new Set([
  "featured",
  "rating",
  "top-rated",
  "newest",
  "name",
]);

/**
 * GET /api/mobile/v1/listings
 *
 * Public, paginated list of published listings. Supports the common filters
 * (category, search, rating, open_now, exclude_featured) and the order-based
 * sorts in {@link SUPPORTED_SORTS}. Deal/distance-ranked sorts (`distance`,
 * `best-deals`, `max-discount`) and deal filters (`deals`, `bank`, `card`) are
 * not yet implemented and are rejected rather than silently ignored.
 *
 * `category` is the stringified integer id from GET /categories (contract
 * section 1, IDs) - not a slug. An id with no matching category (or a
 * non-numeric value) is treated as no filter, same as omitting it.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 9,
    maxLimit: 50,
  });

  const categoryParam =
    searchParams.get("sub") ??
    searchParams.get("subCategory") ??
    searchParams.get("category");
  const rawSearch = searchParams.get("search");
  const sanitizedSearch =
    rawSearch && rawSearch.trim() ? sanitizeSearchTerm(rawSearch) : "";
  const sort = searchParams.get("sort") ?? "featured";
  if (!SUPPORTED_SORTS.has(sort)) {
    throw new MobileApiError(
      "unsupported_sort",
      `Sort '${sort}' is not supported in this version of the API.`,
      400,
      "sort",
    );
  }
  const minRating = searchParams.get("rating");
  const excludeFeatured = searchParams.get("exclude_featured") === "true";

  // Resolve a category id (per the mobile contract, `category` is the
  // stringified integer id returned by GET /categories, not a slug) to the
  // set of category names covering it and its subcategories.
  let categoryNames: string[] = [];
  if (categoryParam && categoryParam !== "all") {
    const categoryId = Number(categoryParam);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      const { rows: categoryRows } = await query(
        `SELECT id, name, parent_id FROM categories WHERE id = $1`,
        [categoryId],
      );
      const category = categoryRows[0];

      if (category) {
        if (category.parent_id === null) {
          const { rows: subcategories } = await query(
            `SELECT name FROM categories WHERE parent_id = $1`,
            [category.id],
          );
          categoryNames = [
            category.name,
            ...subcategories.map((s) => s.name),
          ];
        } else {
          categoryNames = [category.name];
        }
      }
    }
  }

  const whereClauses: string[] = [`status = 'published'`];
  const params: unknown[] = [];

  if (categoryNames.length > 0) {
    params.push(categoryNames);
    whereClauses.push(`category_name = ANY($${params.length}::text[])`);
  }

  if (sanitizedSearch) {
    params.push(`%${sanitizedSearch}%`);
    const idx = params.length;
    whereClauses.push(
      `(name ILIKE $${idx} OR description ILIKE $${idx} OR address ILIKE $${idx})`,
    );
  }

  if (minRating) {
    const rating = parseFloat(minRating);
    if (!Number.isNaN(rating)) {
      params.push(rating);
      whereClauses.push(`avg_rating >= $${params.length}`);
    }
  }

  if (excludeFeatured) {
    whereClauses.push(`is_featured = false`);
  }

  let orderBySql: string;
  switch (sort) {
    case "rating":
    case "top-rated":
      orderBySql = `avg_rating DESC NULLS LAST, id ASC`;
      break;
    case "newest":
      orderBySql = `created_at DESC, id ASC`;
      break;
    case "name":
      orderBySql = `name ASC, id ASC`;
      break;
    default:
      orderBySql = `is_featured DESC NULLS LAST, avg_rating DESC NULLS LAST, id ASC`;
      break;
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  let data: ListingRowLike[];
  let count: number;
  try {
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM listings_with_details ${whereSql}`,
      params,
    );
    count = parseInt(countRows[0].count, 10);

    const dataParams = [...params, limit, offset];
    const { rows } = await query(
      `SELECT ${LISTING_CARD_SQL_COLUMNS} FROM listings_with_details
       ${whereSql}
       ORDER BY ${orderBySql}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );
    data = rows.map(toNumericListingRow);
  } catch (error) {
    console.error(
      "[mobile-api] listings query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load listings.", 500);
  }

  let rows = data ?? [];
  // Match the website's per-page relevance ordering for searches (parity with
  // /api/listings/paginated) so name-prefix matches float to the top.
  if (sanitizedSearch.length >= 2) {
    rows = sortFetchedListingsBySearchRelevance(
      rows as never,
      sanitizedSearch,
    ) as unknown as ListingRowLike[];
  }

  const listingIds = rows
    .map((r) => r.id)
    .filter((id): id is number => typeof id === "number");

  const imagesByListing: Record<number, ListingImageDTO[]> = {};
  if (listingIds.length > 0) {
    const { rows: images } = await query(
      `SELECT id, listing_id, url, alt_text, display_order, is_primary
       FROM listing_images
       WHERE listing_id = ANY($1::int[])
       ORDER BY display_order ASC`,
      [listingIds],
    );

    for (const img of images) {
      (imagesByListing[img.listing_id] ??= []).push(toListingImage(img));
    }
  }

  const listings = rows
    .filter((r) => typeof r.id === "number")
    .map((r) => toListingCard(r, imagesByListing[r.id as number] ?? []));

  return ok(listings, {
    pagination: buildPaginationMeta(page, limit, count ?? 0),
  });
});
