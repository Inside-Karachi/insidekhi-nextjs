import { PremiumListingsGrid } from "@/components/listings/PremiumListingsGrid";
import { FeaturedListingsCarousel } from "@/components/listings/FeaturedListingsCarousel";
import { PremiumListingsHeaderInline as PremiumListingsHeader } from "@/components/listings/PremiumListingsHeaderInline";
import { Database } from "@/types/supabase";
import { getNearbyListings } from "@/app/actions/nearby-listings";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { buildGridSearchParams } from "@/lib/utils/listings-filters";
import {
  stableReorderBySearchRank,
} from "@/lib/listings/search-relevance";
import { query } from "@/lib/db";

// Enable ISR with 60 second revalidation for listings page
export const revalidate = 60;

// Use proper Supabase types
type Listing = Database["public"]["Views"]["listings_with_details"]["Row"] & {
  distance_meters?: number;
};

interface ListingsPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    rating?: string;
    category?: string;
    deals?: string;
    bank?: string;
    card?: string;
    open_now?: string;
    near?: string;
    sub?: string;
    lat?: string;
    lng?: string;
  }>;
}

export default async function ListingsPage({
  searchParams,
}: ListingsPageProps) {
  const resolvedSearchParams = await searchParams;

  const whereClauses: string[] = ["status = 'published'"];
  const queryParams: unknown[] = [];

  // Category filter: handles both parent and subcategories
  if (resolvedSearchParams.category) {
    const { rows: catRows } = await query(
      `SELECT id, name, parent_id FROM categories WHERE slug = $1 LIMIT 1`,
      [resolvedSearchParams.category],
    );
    const cat = catRows[0];

    if (cat) {
      let categoryNames: string[] = [String(cat.name)];
      if (cat.parent_id === null) {
        const { rows: subcategories } = await query(
          `SELECT name FROM categories WHERE parent_id = $1`,
          [cat.id],
        );
        categoryNames = [
          String(cat.name),
          ...subcategories.map((sub) => String(sub.name)),
        ];
      }
      queryParams.push(categoryNames);
      whereClauses.push(`category_name = ANY($${queryParams.length})`);
    }
  }

  // Sub-category filter (overrides or refines category)
  if (resolvedSearchParams.sub) {
    const { rows: subCatRows } = await query(
      `SELECT name FROM categories WHERE slug = $1 LIMIT 1`,
      [resolvedSearchParams.sub],
    );
    const subCat = subCatRows[0];
    if (subCat?.name) {
      if (resolvedSearchParams.category) {
        queryParams.pop();
        whereClauses.pop();
      }
      queryParams.push(String(subCat.name));
      whereClauses.push(`category_name = $${queryParams.length}`);
    }
  }

  if (resolvedSearchParams.search) {
    const term = sanitizeSearchTerm(resolvedSearchParams.search);
    if (term) {
      queryParams.push(`%${term}%`);
      const idx = queryParams.length;
      whereClauses.push(
        `(name ILIKE $${idx} OR description ILIKE $${idx} OR address ILIKE $${idx})`,
      );
    }
  }

  if (resolvedSearchParams.rating) {
    const r = parseFloat(resolvedSearchParams.rating);
    if (!Number.isNaN(r)) {
      queryParams.push(r);
      whereClauses.push(`avg_rating >= $${queryParams.length}`);
    }
  }

  if (resolvedSearchParams.open_now === "true") {
    whereClauses.push("is_open_now = true");
  }

  const whereSql = whereClauses.join(" AND ");
  const { rows: allListings } = await query(
    `SELECT * FROM listings_with_details WHERE ${whereSql} ORDER BY id ASC`,
    queryParams,
  );

  const rawListings = (allListings ?? []) as Array<Record<string, unknown>>;
  let enrichedListings: Listing[] = rawListings
    .filter((l) => l.id != null && !Number.isNaN(Number(l.id)))
    .map((l) => ({ ...l, id: Number(l.id) }) as Listing);
  // No filter on category_name or category_id: show all published listings, even if category is missing

  // Fetch sort options to determine which sorts need deals data
  const { rows: sortOptionsData } = await query(
    `SELECT key, label, icon_name, is_default
     FROM sort_options
     WHERE is_active = true
     ORDER BY display_order ASC`,
  );

  const sortOptions = sortOptionsData || [];
  const sortRequiresDeals = (sortKey: string) => {
    return sortKey === "max-discount" || sortKey === "best-deals";
  };

  const dealsMap: Record<
    number,
    {
      maxDiscount: number;
      hasActive: boolean;
      banks: number[];
      cardVariantIds: number[];
    }
  > = {};
  const needsDeals =
    sortRequiresDeals(resolvedSearchParams.sort || "") ||
    resolvedSearchParams.deals === "true" ||
    resolvedSearchParams.bank ||
    resolvedSearchParams.card;
  if (needsDeals && enrichedListings.length) {
    const listingIds = enrichedListings
      .map((l) => l.id)
      .filter((id) => id !== null);
    const { rows: deals } = await query(
      `SELECT id, listing_id, discount_value, is_active, bank_id, valid_card_variants
       FROM deals
       WHERE listing_id = ANY($1)`,
      [listingIds],
    );
    if (Array.isArray(deals)) {
      interface DealRow {
        listing_id: number | null;
        discount_value: string | null;
        is_active: boolean;
        bank_id: number | null;
        valid_card_variants: number[] | null;
      }
      (deals as DealRow[]).forEach((d) => {
        if (d.listing_id == null) return;
        const lid = d.listing_id;
        if (!dealsMap[lid])
          dealsMap[lid] = {
            maxDiscount: 0,
            hasActive: false,
            banks: [],
            cardVariantIds: [],
          };
        let numeric = 0;
        if (d.discount_value) {
          const m = String(d.discount_value).match(/(\d+)(?=%)/);
          if (m) numeric = parseInt(m[1]);
        }
        dealsMap[lid].maxDiscount = Math.max(
          dealsMap[lid].maxDiscount,
          numeric,
        );
        if (d.is_active) dealsMap[lid].hasActive = true;
        if (d.bank_id) dealsMap[lid].banks.push(d.bank_id);
        if (Array.isArray(d.valid_card_variants))
          dealsMap[lid].cardVariantIds.push(...d.valid_card_variants);
      });
    }
    if (resolvedSearchParams.deals === "true") {
      enrichedListings = enrichedListings.filter(
        (l) => l.id !== null && !!dealsMap[l.id]?.hasActive,
      );
    }
    if (resolvedSearchParams.bank) {
      const bankId = parseInt(resolvedSearchParams.bank);
      enrichedListings = enrichedListings.filter(
        (l) => l.id !== null && dealsMap[l.id]?.banks.includes(bankId),
      );
    }
    if (resolvedSearchParams.card) {
      const cardId = parseInt(resolvedSearchParams.card);
      enrichedListings = enrichedListings.filter(
        (l) => l.id !== null && dealsMap[l.id]?.cardVariantIds.includes(cardId),
      );
    }
    if (sortRequiresDeals(resolvedSearchParams.sort || "")) {
      enrichedListings = [...enrichedListings].sort((a, b) => {
        const discountA = a.id !== null ? dealsMap[a.id]?.maxDiscount || 0 : 0;
        const discountB = b.id !== null ? dealsMap[b.id]?.maxDiscount || 0 : 0;
        if (discountA !== discountB) return discountB - discountA;
        return (a.id || 0) - (b.id || 0);
      });
    }
  }

  // Dynamic sorting based on database sort options
  // CRITICAL: Always add ID as final sort for deterministic ordering
  const currentSort = resolvedSearchParams.sort;
  const defaultSort = sortOptions.find((s) => s.is_default);

  if (currentSort && !sortRequiresDeals(currentSort)) {
    switch (currentSort) {
      case "top-rated":
        enrichedListings = [...enrichedListings].sort((a, b) => {
          const ratingDiff =
            (parseFloat(String(b.avg_rating)) || 0) -
            (parseFloat(String(a.avg_rating)) || 0);
          if (ratingDiff !== 0) return ratingDiff;
          return (a.id || 0) - (b.id || 0); // Deterministic tie-breaker
        });
        break;
      case "newest":
        enrichedListings = [...enrichedListings].sort((a, b) => {
          const dateDiff =
            new Date(String(b.created_at)).getTime() -
            new Date(String(a.created_at)).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (a.id || 0) - (b.id || 0); // Deterministic tie-breaker
        });
        break;
      case "trending":
        enrichedListings = [...enrichedListings].sort((a, b) => {
          const score = (l: Listing) =>
            (l.is_featured ? 50 : 0) +
            (parseFloat(String(l.avg_rating)) || 0) * 10 +
            (Date.now() - new Date(String(l.created_at || "")).getTime()) /
              -86400000;
          const scoreDiff = score(b) - score(a);
          if (scoreDiff !== 0) return scoreDiff;
          return (a.id || 0) - (b.id || 0); // Deterministic tie-breaker
        });
        break;
      case "distance":
        // PostGIS-powered distance sorting
        if (resolvedSearchParams.lat && resolvedSearchParams.lng) {
          const lat = parseFloat(resolvedSearchParams.lat);
          const lng = parseFloat(resolvedSearchParams.lng);

          if (!isNaN(lat) && !isNaN(lng)) {
            const nearbyResult = await getNearbyListings({
              lat,
              lng,
              radius: 50000,
              limit: 100,
            });

            if (nearbyResult.success && nearbyResult.data.length > 0) {
              const distanceMap = new Map<number, number>();
              nearbyResult.data.forEach((item) => {
                distanceMap.set(item.id, item.distance_meters);
              });

              enrichedListings = enrichedListings.map((listing) => ({
                ...listing,
                distance_meters: listing.id
                  ? distanceMap.get(listing.id)
                  : undefined,
              }));

              enrichedListings = [...enrichedListings].sort((a, b) => {
                const distA = a.distance_meters ?? Infinity;
                const distB = b.distance_meters ?? Infinity;
                if (distA !== distB) return distA - distB;
                return (a.id || 0) - (b.id || 0);
              });
            } else {
              enrichedListings = [...enrichedListings].sort((a, b) => {
                const featuredDiff =
                  (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
                if (featuredDiff !== 0) return featuredDiff;
                return (a.id || 0) - (b.id || 0);
              });
            }
          }
        } else {
          enrichedListings = [...enrichedListings].sort((a, b) => {
            const featuredDiff =
              (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
            if (featuredDiff !== 0) return featuredDiff;
            return (a.id || 0) - (b.id || 0);
          });
        }
        break;
      default:
        // For any other sort option, default to featured first
        enrichedListings = [...enrichedListings].sort((a, b) => {
          const featuredDiff =
            (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
          if (featuredDiff !== 0) return featuredDiff;
          return (a.id || 0) - (b.id || 0); // Deterministic tie-breaker
        });
    }
  } else if (!currentSort || (defaultSort && currentSort === defaultSort.key)) {
    // Default sorting (featured first, then by ID)
    enrichedListings = [...enrichedListings].sort((a, b) => {
      const featuredDiff = (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
      if (featuredDiff !== 0) return featuredDiff;
      return (a.id || 0) - (b.id || 0); // Deterministic tie-breaker
    });
  }

  if (
    resolvedSearchParams.search &&
    resolvedSearchParams.sort !== "distance" &&
    !sortRequiresDeals(resolvedSearchParams.sort || "")
  ) {
    enrichedListings = stableReorderBySearchRank(
      enrichedListings,
      resolvedSearchParams.search,
    );
  }

  const { rows: categoriesData } = await query(
    `SELECT id, name, slug, parent_id, icon_name
     FROM categories
     WHERE show_in_filters = true
       AND is_enabled = true
       AND category_type IN ('listing', 'both')
       AND slug <> 'events'
     ORDER BY name ASC
     LIMIT 200`,
  );

  // Hydrate favorite flags server-side for the current user to avoid client round-trips
  try {
    const { getFavoritedListingIdsForUser } =
      await import("@/lib/utils/favorites-server");
    const allIds = enrichedListings
      .map((l) => l.id)
      .filter((id) => id !== null) as number[];
    const favSet = await getFavoritedListingIdsForUser(null, allIds);
    // Attach favorited flag to listings
    enrichedListings = enrichedListings.map((l) => ({
      ...l,
      favorited: l.id !== null && favSet.has(l.id),
    }));
  } catch (err) {
    console.error("Failed to hydrate favorites for listings page", err);
  }

  // Fetch images for all listings to display in cards (matches [slug] page behavior)
  type ListingWithImages = Listing & {
    images?: Array<{
      id: number;
      listing_id: number;
      url: string;
      alt_text: string | null;
      display_order: number | null;
      is_primary: boolean | null;
      created_at: string;
      updated_at: string;
    }>;
  };

  const listingIds = enrichedListings
    .filter((l) => l.id != null)
    .map((l) => Number(l.id));

  const imagesMap: Record<number, ListingWithImages["images"]> = {};

  if (listingIds.length > 0) {
    const { rows: allImages } = await query(
      `SELECT * FROM listing_images
       WHERE listing_id = ANY($1)
       ORDER BY display_order ASC`,
      [listingIds],
    );

    if (Array.isArray(allImages)) {
      allImages.forEach((img) => {
        const listingId = img.listing_id as number;
        if (!imagesMap[listingId]) {
          imagesMap[listingId] = [];
        }
        imagesMap[listingId]!.push(img as ListingWithImages["images"][number]);
      });
    }
  }

  // Merge images into listings
  enrichedListings = enrichedListings.map((listing) => ({
    ...listing,
    images: listing.id ? imagesMap[listing.id] || [] : [],
  })) as ListingWithImages[];

  // Separate featured listings for carousel
  const featuredListings = enrichedListings
    .filter((l) => l.is_featured)
    .sort((a, b) => {
      const da =
        (a as unknown as { display_order?: number }).display_order ?? 0;
      const db =
        (b as unknown as { display_order?: number }).display_order ?? 0;
      if (db !== da) return db - da; // higher display_order first
      const ta = new Date(String(a.created_at || 0)).getTime();
      const tb = new Date(String(b.created_at || 0)).getTime();
      if (tb !== ta) return tb - ta; // newer first
      return (b.id || 0) - (a.id || 0);
    });
  const nonFeaturedListings = enrichedListings.filter((l) => !l.is_featured);

  // Conform to PremiumListingsGrid expected searchParams shape
  const gridSearchParams = buildGridSearchParams(
    {
      search: resolvedSearchParams.search,
      sort: resolvedSearchParams.sort,
      rating: resolvedSearchParams.rating,
      category: resolvedSearchParams.category,
      sub: resolvedSearchParams.sub,
      deals: resolvedSearchParams.deals,
      bank: resolvedSearchParams.bank,
      card: resolvedSearchParams.card,
      open_now: resolvedSearchParams.open_now,
      near: resolvedSearchParams.near,
      lat: resolvedSearchParams.lat,
      lng: resolvedSearchParams.lng,
    },
    resolvedSearchParams.category,
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PremiumListingsHeader
        categories={[
          {
            id: 0,
            name: "All",
            slug: "all",
            parent_id: null,
            icon_name: "compass",
          },
          ...(categoriesData || []),
        ]}
      />

      <div className="container mx-auto px-6 lg:px-8 py-12 space-y-12">
        {/* Featured Listings Carousel - Only show if we have featured listings and no specific filters */}
        {featuredListings.length > 0 &&
          !resolvedSearchParams.search &&
          !resolvedSearchParams.category && (
            <FeaturedListingsCarousel featuredListings={featuredListings} />
          )}

        {/* Main Listings Grid */}
        <div>
          <PremiumListingsGrid
            listings={
              resolvedSearchParams.search || resolvedSearchParams.category
                ? enrichedListings
                    .filter((l) => l.id !== null)
                    .map((l) => ({ ...l, id: l.id as number }))
                : nonFeaturedListings
                    .filter((l) => l.id !== null)
                    .map((l) => ({ ...l, id: l.id as number }))
            }
            excludeFeaturedFromApi={
              !resolvedSearchParams.search && !resolvedSearchParams.category
            }
            searchParams={gridSearchParams}
          />
        </div>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ searchParams }: ListingsPageProps) {
  const resolvedSearchParams = await searchParams;
  let title = "All Listings - Inside Karachi";
  let description = "Discover all the amazing places in Karachi";

  if (resolvedSearchParams.search) {
    title = `Search results for "${resolvedSearchParams.search}" - Inside Karachi`;
    description = `Find places matching "${resolvedSearchParams.search}" in Karachi`;
  } else if (resolvedSearchParams.category) {
    title = `${resolvedSearchParams.category} Listings - Inside Karachi`;
    description = `Discover the best ${resolvedSearchParams.category} places in Karachi`;
  }

  return {
    title,
    description,
  };
}
