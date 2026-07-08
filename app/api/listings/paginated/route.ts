import { createServerSupabase } from "@/lib/supabase/server";
import { getNearbyListings } from "@/app/actions/nearby-listings";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  buildListingSearchOrFilter,
  compareSearchRankThenIds,
  sortFetchedListingsBySearchRelevance,
} from "@/lib/listings/search-relevance";
import { NextRequest, NextResponse } from "next/server";

type DealRow = {
  listing_id: number | null;
  discount_value: string | null;
  is_active: boolean;
  bank_id: number | null;
  valid_card_variants: number[] | null;
  end_date: string | null;
};

type ListingsRow = {
  id: number | null;
  [key: string]: unknown;
};

/**
 * Paginated Listings API
 *
 * Query Parameters:
 * - page, limit
 * - category, sub
 * - search, sort, rating
 * - deals, bank, card
 * - open_now
 * - lat, lng (distance sort)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase({ publicAnon: true });
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "9", 10)),
    );
    const offset = (page - 1) * limit;

    const subSlug = searchParams.get("sub") || searchParams.get("subCategory");
    const categorySlug = subSlug || searchParams.get("category");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "featured";
    const minRating = searchParams.get("rating");
    const dealsOnly = searchParams.get("deals") === "true";
    const bankParam = searchParams.get("bank");
    const cardParam = searchParams.get("card");
    const openNow = searchParams.get("open_now") === "true";
    const excludeFeatured = searchParams.get("exclude_featured") === "true";
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const hasDistanceSort = sort === "distance" && !Number.isNaN(lat) && !Number.isNaN(lng);

    const sortRequiresDeals = (sortKey: string): boolean =>
      sortKey === "max-discount" || sortKey === "best-deals";

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
            ...(subcategories?.map((sub) => sub.name) || []),
          ];
        } else {
          categoryNames = [category.name];
        }
      }
    }

    const needsDeals =
      dealsOnly || !!bankParam || !!cardParam || sortRequiresDeals(sort);

    const maxDiscountByListingId: Record<number, number> = {};
    let constrainedByDealsIds: number[] | null = null;

    if (needsDeals) {
      const { data: dealsRows } = await supabase
        .from("deals")
        .select(
          "listing_id, discount_value, is_active, bank_id, valid_card_variants, end_date",
        );

      const nowMs = Date.now();
      const bankId = bankParam ? parseInt(bankParam, 10) : null;
      const cardId = cardParam ? parseInt(cardParam, 10) : null;

      const filteredIds = new Set<number>();

      (dealsRows as DealRow[] | null)?.forEach((deal) => {
        if (deal.listing_id == null) return;

        const lid = deal.listing_id;
        const endMs = deal.end_date ? Date.parse(deal.end_date) : Number.POSITIVE_INFINITY;
        const isActiveNow = deal.is_active && endMs >= nowMs;

        let maxDiscount = 0;
        if (deal.discount_value) {
          const match = String(deal.discount_value).match(/(\d+)(?=%)/);
          if (match) {
            maxDiscount = parseInt(match[1], 10);
          }
        }
        maxDiscountByListingId[lid] = Math.max(maxDiscountByListingId[lid] || 0, maxDiscount);

        const bankMatch = bankId != null && !Number.isNaN(bankId) ? deal.bank_id === bankId : true;
        const cardMatch =
          cardId != null && !Number.isNaN(cardId)
            ? Array.isArray(deal.valid_card_variants) && deal.valid_card_variants.includes(cardId)
            : true;
        const dealsMatch = dealsOnly ? isActiveNow : true;

        if (dealsMatch && bankMatch && cardMatch) {
          filteredIds.add(lid);
        }
      });

      constrainedByDealsIds = Array.from(filteredIds);
      if (needsDeals && constrainedByDealsIds.length === 0) {
        return NextResponse.json({
          listings: [],
          pagination: {
            page,
            limit,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
    }

    const sanitizedSearch =
      search && search.trim() ? sanitizeSearchTerm(search) : "";
    const shouldApplySearchRankSort = sanitizedSearch.length >= 2;

    let dbQuery = supabase
      .from("listings_with_details")
      .select("*", { count: "exact" })
      .eq("status", "published");

    if (categoryNames.length > 0) {
      dbQuery = dbQuery.in("category_name", categoryNames);
    }

    if (search && search.trim()) {
      const orClause = buildListingSearchOrFilter(sanitizedSearch);
      if (orClause) {
        dbQuery = dbQuery.or(orClause);
      }
    }

    if (minRating) {
      const rating = parseFloat(minRating);
      if (!Number.isNaN(rating)) {
        dbQuery = dbQuery.gte("avg_rating", rating);
      }
    }

    if (openNow) {
      dbQuery = dbQuery.eq("is_open_now", true);
    }

    if (excludeFeatured) {
      dbQuery = dbQuery.eq("is_featured", false);
    }

    if (constrainedByDealsIds && constrainedByDealsIds.length > 0) {
      dbQuery = dbQuery.in("id", constrainedByDealsIds);
    }

    let listings: ListingsRow[] = [];
    let totalItems = 0;

    if (hasDistanceSort || sortRequiresDeals(sort)) {
      const chunkSize = 500;
      let hasMore = true;
      let chunkOffset = 0;
      const allRows: ListingsRow[] = [];

      while (hasMore) {
        const { data: chunk, error } = await dbQuery.range(
          chunkOffset,
          chunkOffset + chunkSize - 1,
        );

        if (error) {
          console.error("Listings API in-memory fetch error:", error);
          return NextResponse.json(
            { error: "Failed to fetch listings", details: error.message },
            { status: 500 },
          );
        }

        if (!chunk || chunk.length === 0) {
          hasMore = false;
        } else {
          allRows.push(...((chunk as unknown as ListingsRow[]) ?? []));
          if (chunk.length < chunkSize) {
            hasMore = false;
          } else {
            chunkOffset += chunkSize;
          }
        }
      }

      let sorted = allRows;

      if (hasDistanceSort) {
        const nearby = await getNearbyListings({
          lat,
          lng,
          radius: 50000,
          limit: 100,
        });

        const distanceMap = new Map<number, number>();
        if (nearby.success) {
          nearby.data.forEach((item) => {
            distanceMap.set(item.id, item.distance_meters);
          });
        }

        sorted = sorted
          .filter((row) => row.id != null && distanceMap.has(row.id))
          .map((row) => ({
            ...row,
            distance_meters: row.id != null ? distanceMap.get(row.id) : undefined,
          }))
          .sort((a, b) => {
            const distA = typeof a.distance_meters === "number" ? a.distance_meters : Number.POSITIVE_INFINITY;
            const distB = typeof b.distance_meters === "number" ? b.distance_meters : Number.POSITIVE_INFINITY;
            return compareSearchRankThenIds(
              a as Record<string, unknown> & { id?: number | null },
              b as Record<string, unknown> & { id?: number | null },
              search ?? undefined,
              distA - distB,
            );
          });
      } else {
        sorted = sorted.sort((a, b) => {
          const discountA = a.id != null ? maxDiscountByListingId[a.id] || 0 : 0;
          const discountB = b.id != null ? maxDiscountByListingId[b.id] || 0 : 0;
          return compareSearchRankThenIds(
            a as Record<string, unknown> & { id?: number | null },
            b as Record<string, unknown> & { id?: number | null },
            search ?? undefined,
            discountB - discountA,
          );
        });
      }

      totalItems = sorted.length;
      listings = sorted.slice(offset, offset + limit);
    } else {
      switch (sort) {
        case "rating":
        case "top-rated":
          dbQuery = dbQuery
            .order("avg_rating", { ascending: false, nullsFirst: false })
            .order("id", { ascending: true });
          break;
        case "newest":
          dbQuery = dbQuery
            .order("created_at", { ascending: false })
            .order("id", { ascending: true });
          break;
        case "name":
          dbQuery = dbQuery
            .order("name", { ascending: true })
            .order("id", { ascending: true });
          break;
        case "featured":
        default:
          dbQuery = dbQuery
            .order("is_featured", { ascending: false, nullsFirst: false })
            .order("avg_rating", { ascending: false, nullsFirst: false })
            .order("id", { ascending: true });
          break;
      }

      dbQuery = dbQuery.range(offset, offset + limit - 1);

      const { data, count, error } = await dbQuery;
      if (error) {
        console.error("Listings API error:", error);
        return NextResponse.json(
          { error: "Failed to fetch listings", details: error.message },
          { status: 500 },
        );
      }

      listings = (data || []) as unknown as ListingsRow[];
      if (shouldApplySearchRankSort) {
        listings = sortFetchedListingsBySearchRelevance(
          listings as never,
          sanitizedSearch,
        ) as ListingsRow[];
      }
      totalItems = count || 0;
    }

    const listingIds = listings
      .filter((l) => typeof l.id === "number" && l.id !== null)
      .map((l) => l.id as number);

    type ListingImage = {
      id: number;
      listing_id: number;
      url: string;
      alt_text: string | null;
      display_order: number | null;
      is_primary: boolean | null;
      created_at: string;
      updated_at: string;
    };

    const imagesMap: Record<number, ListingImage[]> = {};

    if (listingIds.length > 0) {
      const { data: images } = await supabase
        .from("listing_images")
        .select("*")
        .in("listing_id", listingIds)
        .order("display_order", { ascending: true });

      if (Array.isArray(images)) {
        images.forEach((img) => {
          if (!imagesMap[img.listing_id]) {
            imagesMap[img.listing_id] = [];
          }
          imagesMap[img.listing_id].push(img);
        });
      }
    }

    const enrichedListings = listings.map((listing) => ({
      ...listing,
      images: listing.id ? imagesMap[listing.id] || [] : [],
    }));

    const totalPages = Math.ceil(totalItems / limit);

    return NextResponse.json({
      listings: enrichedListings,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Listings API unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
