import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  LISTING_CARD_COLUMNS,
  toListingCard,
  toListingImage,
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  buildListingSearchOrFilter,
  sortFetchedListingsBySearchRelevance,
} from "@/lib/listings/search-relevance";

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
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const supabase = createMobilePublicClient();
  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 9,
    maxLimit: 50,
  });

  const categorySlug =
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

  // Resolve a category slug to the set of category names (parent + children).
  let categoryNames: string[] = [];
  if (categorySlug && categorySlug !== "all") {
    const { data: category } = await supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("slug", categorySlug)
      .single();

    if (category) {
      if (category.parent_id === null) {
        const { data: subcategories } = await supabase
          .from("categories")
          .select("name")
          .eq("parent_id", category.id);
        categoryNames = [
          category.name,
          ...(subcategories?.map((s) => s.name) ?? []),
        ];
      } else {
        categoryNames = [category.name];
      }
    }
  }

  let query = supabase
    .from("listings_with_details")
    .select(LISTING_CARD_COLUMNS, { count: "exact" })
    .eq("status", "published");

  if (categoryNames.length > 0) {
    query = query.in("category_name", categoryNames);
  }

  if (sanitizedSearch) {
    const orClause = buildListingSearchOrFilter(sanitizedSearch);
    if (orClause) query = query.or(orClause);
  }

  if (minRating) {
    const rating = parseFloat(minRating);
    if (!Number.isNaN(rating)) query = query.gte("avg_rating", rating);
  }

  if (excludeFeatured) query = query.eq("is_featured", false);

  switch (sort) {
    case "rating":
    case "top-rated":
      query = query
        .order("avg_rating", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });
      break;
    case "newest":
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
      break;
    case "name":
      query = query
        .order("name", { ascending: true })
        .order("id", { ascending: true });
      break;
    default:
      query = query
        .order("is_featured", { ascending: false, nullsFirst: false })
        .order("avg_rating", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });
      break;
  }

  const { data, count, error } = await query
    .range(offset, offset + limit - 1)
    .returns<ListingRowLike[]>();
  if (error) {
    console.error("[mobile-api] listings query failed:", error.message);
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
    const { data: images } = await supabase
      .from("listing_images")
      .select("id, listing_id, url, alt_text, display_order, is_primary")
      .in("listing_id", listingIds)
      .order("display_order", { ascending: true });

    for (const img of images ?? []) {
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
