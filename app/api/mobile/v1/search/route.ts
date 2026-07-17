import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { sortFetchedListingsBySearchRelevance } from "@/lib/listings/search-relevance";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

type ListingSearchRow = {
  id: number;
  name: string | null;
  slug: string | null;
  description: string | null;
  address: string | null;
  category_name: string | null;
  is_featured: boolean | null;
  avg_rating: number | null;
  review_count: number | null;
};

type SearchResult =
  | {
      type: "listing";
      id: number;
      name: string | null;
      slug: string | null;
      description: string | null;
      address: string | null;
      category: string | null;
      avg_rating: number | null;
      review_count: number | null;
    }
  | {
      type: "event";
      id: number;
      name: string | null;
      slug: string | null;
      description: string | null;
      start_time: string | null;
      end_time: string | null;
    }
  | {
      type: "post";
      id: number;
      name: string | null;
      slug: string | null;
      description: string | null;
    };

/**
 * GET /api/mobile/v1/search?q=&limit=
 *
 * Unified search across listings, events and posts, tagged by `type`. Mirrors
 * the website's `app/api/search` handler, normalized to allow-listed fields per
 * type. Posts and events are published-only in v1 (display-only per contract
 * section 6).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
    ),
  );

  const sanitized =
    rawQuery.trim().length >= MIN_QUERY_LENGTH
      ? sanitizeSearchTerm(rawQuery)
      : "";
  if (sanitized.length < MIN_QUERY_LENGTH) {
    throw new MobileApiError(
      "validation_error",
      "Query must be at least 2 characters long.",
      400,
      "q",
    );
  }

  const searchTerm = `%${sanitized}%`;
  const results: SearchResult[] = [];

  let listingsRes, eventsRes, postsRes;
  try {
    [listingsRes, eventsRes, postsRes] = await Promise.all([
      query(
        `SELECT id, name, slug, description, address, category_name, is_featured, avg_rating, review_count
         FROM listings_with_details
         WHERE status = 'published'
           AND (name ILIKE $1 OR description ILIKE $1 OR address ILIKE $1)
         LIMIT $2`,
        [searchTerm, Math.min(50, limit * 3)],
      ),
      query(
        `SELECT id, name, slug, description,
           to_json(start_time) #>> '{}' AS start_time,
           to_json(end_time) #>> '{}' AS end_time
         FROM events
         WHERE status = 'published'
           AND (name ILIKE $1 OR description ILIKE $1)
           AND start_time >= NOW()
         LIMIT $2`,
        [searchTerm, limit],
      ),
      query(
        `SELECT id, title, slug, excerpt
         FROM posts
         WHERE status = 'published'
           AND (title ILIKE $1 OR excerpt ILIKE $1)
         LIMIT $2`,
        [searchTerm, limit],
      ),
    ]);
  } catch (error) {
    console.error("[mobile-api] search query failed:", error);
    throw new MobileApiError("internal_error", "Failed to search.", 500);
  }

  const listingRows: ListingSearchRow[] = listingsRes.rows.map((row) => ({
    id: Number(row.id),
    name: row.name as string | null,
    slug: row.slug as string | null,
    description: row.description as string | null,
    address: row.address as string | null,
    category_name: row.category_name as string | null,
    is_featured: row.is_featured as boolean | null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
  }));

  const listingsOrdered = sortFetchedListingsBySearchRelevance(
    listingRows,
    sanitized,
  ).slice(0, limit);

  for (const listing of listingsOrdered) {
    results.push({
      type: "listing",
      id: listing.id,
      name: listing.name,
      slug: listing.slug,
      description: listing.description,
      address: listing.address,
      category: listing.category_name,
      avg_rating: listing.avg_rating,
      review_count: listing.review_count,
    });
  }

  for (const event of eventsRes.rows) {
    results.push({
      type: "event",
      id: Number(event.id),
      name: event.name as string | null,
      slug: event.slug as string | null,
      description: event.description as string | null,
      start_time: event.start_time as string | null,
      end_time: event.end_time as string | null,
    });
  }

  for (const post of postsRes.rows) {
    results.push({
      type: "post",
      id: Number(post.id),
      name: post.title as string | null,
      slug: post.slug as string | null,
      description: post.excerpt as string | null,
    });
  }

  const sliced = results.slice(0, limit);
  return ok({ query: rawQuery, results: sliced, total: sliced.length });
});
