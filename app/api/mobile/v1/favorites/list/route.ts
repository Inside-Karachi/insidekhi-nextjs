import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
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

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/favorites/list?page=&limit=
 *
 * The caller's favorited listings as paginated ListingCards, most-recently
 * favorited first. Favorites whose listing is no longer published are omitted
 * from the page (RLS hides them) though they still count toward the total.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 9,
    maxLimit: 50,
  });

  // Page over the user's favorites (own-rows-only via RLS), newest first.
  const {
    data: favs,
    count,
    error: favError,
  } = await supabase
    .from("favorite_listings")
    .select("listing_id", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (favError) {
    console.error("[mobile-api] favorites query failed:", favError.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load favorites.",
      500,
    );
  }

  const orderedIds = (favs ?? []).map((f) => f.listing_id);
  const total = count ?? 0;

  if (orderedIds.length === 0) {
    return ok([], { pagination: buildPaginationMeta(page, limit, total) });
  }

  // Resolve the favorited listings (published-only via the view's RLS).
  const { data: listingRows, error: listError } = await supabase
    .from("listings_with_details")
    .select(LISTING_CARD_COLUMNS)
    .in("id", orderedIds)
    .eq("status", "published")
    .returns<ListingRowLike[]>();
  if (listError) {
    console.error(
      "[mobile-api] favorite listings query failed:",
      listError.message,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load favorites.",
      500,
    );
  }

  const rows = listingRows ?? [];
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

  // Preserve the favorite order (the IN query returns rows arbitrarily).
  const byId = new Map<number, ListingRowLike>();
  for (const r of rows) {
    if (typeof r.id === "number") byId.set(r.id, r);
  }
  const listings = orderedIds
    .map((id) => byId.get(id))
    .filter((r): r is ListingRowLike => r != null)
    .map((r) => toListingCard(r, imagesByListing[r.id as number] ?? []));

  return ok(listings, {
    pagination: buildPaginationMeta(page, limit, total),
  });
});
