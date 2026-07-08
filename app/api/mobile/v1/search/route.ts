import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  buildListingSearchOrFilter,
  sortFetchedListingsBySearchRelevance,
} from "@/lib/listings/search-relevance";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

type ListingSearchRow = Pick<
  Database["public"]["Views"]["listings_with_details"]["Row"],
  | "id"
  | "name"
  | "slug"
  | "description"
  | "address"
  | "category_name"
  | "is_featured"
  | "avg_rating"
  | "review_count"
>;
type EventSearchRow = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "name" | "slug" | "description" | "start_time" | "end_time"
>;
type PostSearchRow = Pick<
  Database["public"]["Tables"]["posts"]["Row"],
  "id" | "title" | "slug" | "excerpt"
>;

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
 * type. Posts are anon-gated by RLS, so they only appear for callers that can
 * read them (display-only in v1 per contract section 6).
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

  const supabase = createMobilePublicClient();
  const searchTerm = `%${sanitized}%`;
  const results: SearchResult[] = [];

  const listingOrFilter = buildListingSearchOrFilter(sanitized);
  let listingsQuery = supabase
    .from("listings_with_details")
    .select(
      "id, name, slug, description, address, category_name, is_featured, avg_rating, review_count",
    )
    .eq("status", "published");
  if (listingOrFilter) listingsQuery = listingsQuery.or(listingOrFilter);

  const { data: listingsRaw } = await listingsQuery
    .returns<ListingSearchRow[]>()
    .limit(Math.min(50, limit * 3));

  const listingsOrdered = sortFetchedListingsBySearchRelevance(
    (listingsRaw ?? []) as never,
    sanitized,
  ).slice(0, limit) as unknown as ListingSearchRow[];

  for (const listing of listingsOrdered) {
    if (listing.id == null) continue;
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

  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, description, start_time, end_time")
    .eq("status", "published")
    .or(`name.ilike."${searchTerm}",description.ilike."${searchTerm}"`)
    .gte("start_time", new Date().toISOString())
    .returns<EventSearchRow[]>()
    .limit(limit);

  for (const event of events ?? []) {
    results.push({
      type: "event",
      id: event.id,
      name: event.name,
      slug: event.slug,
      description: event.description,
      start_time: event.start_time,
      end_time: event.end_time,
    });
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt")
    .eq("status", "published")
    .or(`title.ilike."${searchTerm}",excerpt.ilike."${searchTerm}"`)
    .returns<PostSearchRow[]>()
    .limit(limit);

  for (const post of posts ?? []) {
    results.push({
      type: "post",
      id: post.id,
      name: post.title,
      slug: post.slug,
      description: post.excerpt,
    });
  }

  const sliced = results.slice(0, limit);
  return ok({ query: rawQuery, results: sliced, total: sliced.length });
});
