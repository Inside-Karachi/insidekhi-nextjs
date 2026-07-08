import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PremiumListingsGrid } from "@/components/listings/PremiumListingsGrid";
import { FeaturedListingsCarousel } from "@/components/listings/FeaturedListingsCarousel";
import { PremiumListingsHeaderInline as PremiumListingsHeader } from "@/components/listings/PremiumListingsHeaderInline";
import { Database } from "@/types/supabase";
import { getNearbyListings } from "@/app/actions/nearby-listings";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { buildGridSearchParams } from "@/lib/utils/listings-filters";
import {
  compareSearchRankThenIds,
  stableReorderBySearchRank,
} from "@/lib/listings/search-relevance";

// Use proper Supabase types
type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface CategoryListingsPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    search?: string;
    sort?: string;
    rating?: string;
    sub?: string;
    deals?: string;
    bank?: string;
    card?: string;
    open_now?: string;
    near?: string;
    lat?: string;
    lng?: string;
  }>;
}

export default async function CategoryListingsPage({
  params,
  searchParams,
}: CategoryListingsPageProps) {
  const publicSupabase = await createServerSupabase({ publicAnon: true });
  const userSupabase = await createServerSupabase();
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const searchTermResolved = resolvedSearchParams.search
    ? sanitizeSearchTerm(resolvedSearchParams.search)
    : "";

  // Fetch the category
  const { data: category, error: categoryError } = await publicSupabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (categoryError || !category) {
    if (categoryError) {
      console.error("[category-listings] Failed to fetch category:", {
        slug,
        code: categoryError.code,
        message: categoryError.message,
      });
    }
    notFound();
  }

  // Build query for listings
  let query = publicSupabase
    .from("listings_with_details")
    .select("*")
    .eq("status", "published");

  // Slug page grid intentionally excludes featured items because featured content is shown in carousel.
  query = query.eq("is_featured", false);

  // Pre-compute category names array for filtering (reused throughout)
  let categoryNamesForFilter: string[] = [category.name];

  // Filter by category using category_name from the view
  // Since listings_with_details view has category_name, not category_id
  if (category.parent_id === null) {
    // Parent category - get all listings in this category and its subcategories
    const { data: subcategories } = await publicSupabase
      .from("categories")
      .select("name")
      .eq("parent_id", category.id);

    categoryNamesForFilter = [
      category.name,
      ...(subcategories?.map((sub) => sub.name) || []),
    ];
    query = query.in("category_name", categoryNamesForFilter);
  } else {
    // Subcategory - get listings only in this specific category
    query = query.eq("category_name", category.name);
  }

  // Apply search filter
  if (resolvedSearchParams.search && searchTermResolved) {
    query = query.or(
      `name.ilike.%${searchTermResolved}%,description.ilike.%${searchTermResolved}%,address.ilike.%${searchTermResolved}%`,
    );
  }

  // Apply rating filter
  if (resolvedSearchParams.rating) {
    const rating = parseFloat(resolvedSearchParams.rating);
    if (!Number.isNaN(rating)) {
      query = query.gte("avg_rating", rating);
    }
  }

  // Apply open-now filter when explicitly requested
  if (resolvedSearchParams.open_now === "true") {
    query = query.eq("is_open_now", true);
  }

  const sortRequiresDeals = (sortKey: string | undefined): boolean => {
    return sortKey === "max-discount" || sortKey === "best-deals";
  };

  const needsDealsFilter =
    resolvedSearchParams.deals === "true" ||
    !!resolvedSearchParams.bank ||
    !!resolvedSearchParams.card ||
    sortRequiresDeals(resolvedSearchParams.sort);

  const maxDiscountByListingId: Record<number, number> = {};
  let dealFilteredIdsForFilter: number[] | null = null;

  if (needsDealsFilter) {
    type DealRow = {
      listing_id: number | null;
      discount_value: string | null;
      is_active: boolean;
      bank_id: number | null;
      valid_card_variants: number[] | null;
      end_date: string | null;
    };

    const { data: dealRows } = await publicSupabase
      .from("deals")
      .select(
        "listing_id, discount_value, is_active, bank_id, valid_card_variants, end_date",
      );

    const nowMs = Date.now();
    const bankId = resolvedSearchParams.bank
      ? parseInt(resolvedSearchParams.bank, 10)
      : null;
    const cardId = resolvedSearchParams.card
      ? parseInt(resolvedSearchParams.card, 10)
      : null;

    const filteredListingIds = new Set<number>();

    (dealRows as DealRow[] | null)?.forEach((deal) => {
      if (deal.listing_id == null) return;

      const lid = deal.listing_id;
      const endMs = deal.end_date
        ? Date.parse(deal.end_date)
        : Number.POSITIVE_INFINITY;
      const isActiveNow = deal.is_active && endMs >= nowMs;

      let numericDiscount = 0;
      if (deal.discount_value) {
        const m = String(deal.discount_value).match(/(\d+)(?=%)/);
        if (m) numericDiscount = parseInt(m[1], 10);
      }
      maxDiscountByListingId[lid] = Math.max(
        maxDiscountByListingId[lid] || 0,
        numericDiscount,
      );

      const bankMatch =
        bankId != null && !Number.isNaN(bankId)
          ? deal.bank_id === bankId
          : true;
      const cardMatch =
        cardId != null && !Number.isNaN(cardId)
          ? Array.isArray(deal.valid_card_variants) &&
            deal.valid_card_variants.includes(cardId)
          : true;
      const dealsMatch =
        resolvedSearchParams.deals === "true" ? isActiveNow : true;

      if (dealsMatch && bankMatch && cardMatch) {
        filteredListingIds.add(lid);
      }
    });

    dealFilteredIdsForFilter = Array.from(filteredListingIds);
    if (dealFilteredIdsForFilter.length === 0) {
      query = query.eq("id", -1);
    } else {
      query = query.in("id", dealFilteredIdsForFilter);
    }
  }

  const buildFilteredCountQuery = () => {
    let countQuery = publicSupabase
      .from("listings_with_details")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .eq("is_featured", false)
      .in("category_name", categoryNamesForFilter);

    if (resolvedSearchParams.search && searchTermResolved) {
      countQuery = countQuery.or(
        `name.ilike.%${searchTermResolved}%,description.ilike.%${searchTermResolved}%,address.ilike.%${searchTermResolved}%`,
      );
    }

    if (resolvedSearchParams.rating) {
      const rating = parseFloat(resolvedSearchParams.rating);
      if (!Number.isNaN(rating)) {
        countQuery = countQuery.gte("avg_rating", rating);
      }
    }

    if (resolvedSearchParams.open_now === "true") {
      countQuery = countQuery.eq("is_open_now", true);
    }

    if (dealFilteredIdsForFilter) {
      if (dealFilteredIdsForFilter.length === 0) {
        countQuery = countQuery.eq("id", -1);
      } else {
        countQuery = countQuery.in("id", dealFilteredIdsForFilter);
      }
    }

    return countQuery;
  };

  // Apply sorting (skip distance - handled after fetch with PostGIS)
  switch (resolvedSearchParams.sort) {
    case "distance":
      // Distance sorting will be applied after fetch using PostGIS
      break;
    case "rating":
      query = query
        .order("avg_rating", { ascending: false })
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
    case "max-discount":
    case "best-deals":
      // Deals sort is applied after fetch using computed maxDiscountByListingId.
      break;
    default:
      // Default: featured first, then by rating
      query = query
        .order("is_featured", { ascending: false })
        .order("avg_rating", { ascending: false })
        .order("id", { ascending: true });
  }

  // PERFORMANCE OPTIMIZATION: Only fetch first page + count, not all listings
  // The PremiumListingsGrid component will handle pagination via API calls
  const INITIAL_PAGE_SIZE = 12;

  // Special handling for distance sort: fetch nearby listings first
  let listings: Array<Listing & { distance_meters?: number }>;
  let totalCount: number | null = null;

  if (
    resolvedSearchParams.sort === "distance" &&
    resolvedSearchParams.lat &&
    resolvedSearchParams.lng
  ) {
    const lat = parseFloat(resolvedSearchParams.lat);
    const lng = parseFloat(resolvedSearchParams.lng);

    if (!isNaN(lat) && !isNaN(lng)) {
      // Fetch nearby listings using PostGIS (already sorted by distance)
      const nearbyResult = await getNearbyListings({
        lat,
        lng,
        radius: 50000,
        limit: INITIAL_PAGE_SIZE,
      });

      if (nearbyResult.success && nearbyResult.data.length > 0) {
        const nearbyIds = nearbyResult.data.map((item) => item.id);

        // Fetch full details for nearby listings only
        let nearbyListingsQuery = publicSupabase
          .from("listings_with_details")
          .select("*")
          .eq("status", "published")
          .eq("is_featured", false)
          .in("category_name", categoryNamesForFilter)
          .in("id", nearbyIds);

        if (resolvedSearchParams.search && searchTermResolved) {
          nearbyListingsQuery = nearbyListingsQuery.or(
            `name.ilike.%${searchTermResolved}%,description.ilike.%${searchTermResolved}%,address.ilike.%${searchTermResolved}%`,
          );
        }

        if (resolvedSearchParams.rating) {
          const rating = parseFloat(resolvedSearchParams.rating);
          if (!Number.isNaN(rating)) {
            nearbyListingsQuery = nearbyListingsQuery.gte("avg_rating", rating);
          }
        }

        if (resolvedSearchParams.open_now === "true") {
          nearbyListingsQuery = nearbyListingsQuery.eq("is_open_now", true);
        }

        if (dealFilteredIdsForFilter) {
          if (dealFilteredIdsForFilter.length === 0) {
            nearbyListingsQuery = nearbyListingsQuery.eq("id", -1);
          } else {
            nearbyListingsQuery = nearbyListingsQuery.in("id", dealFilteredIdsForFilter);
          }
        }

      const { data: nearbyListingsRaw } = await nearbyListingsQuery;
        const nearbyListings = nearbyListingsRaw as unknown as Listing[] | null;

        // Attach distance_meters to each listing
        const distanceMap = new Map(
          nearbyResult.data.map((item) => [item.id, item.distance_meters]),
        );

        listings = (nearbyListings || []).map((listing) => ({
          ...listing,
          distance_meters: distanceMap.get(listing.id as number),
        }));

        // Sort by distance (PostGIS already did this, but ensure consistency)
        listings.sort((a, b) => {
          const distA = (a.distance_meters as number | undefined) ?? Infinity;
          const distB = (b.distance_meters as number | undefined) ?? Infinity;
          return compareSearchRankThenIds(
            a as Record<string, unknown> & { id?: number | null },
            b as Record<string, unknown> & { id?: number | null },
            resolvedSearchParams.search,
            distA - distB,
          );
        });

        // Use filtered count query for accurate pagination total
        const { count: nearbyTotalCount } = await buildFilteredCountQuery();
        totalCount = nearbyTotalCount;
      } else {
        // No nearby listings, fall back to regular fetch
        listings = [];
        totalCount = 0;
      }
    } else {
      // Invalid coordinates, fall back to regular fetch
      const { data: firstPageListings } = await query.range(
        0,
        INITIAL_PAGE_SIZE - 1,
      );
      listings = (firstPageListings || []) as unknown as Array<
        Listing & { distance_meters?: number }
      >;

      const { count } = await buildFilteredCountQuery();
      totalCount = count;
    }
  } else {
    // Regular sort: fetch first page normally
    const { count } = await buildFilteredCountQuery();
    totalCount = count;

    const { data: firstPageListings } = await query.range(
      0,
      INITIAL_PAGE_SIZE - 1,
    );
    listings = (firstPageListings || []) as unknown as Array<
      Listing & { distance_meters?: number }
    >;
  }

  if (sortRequiresDeals(resolvedSearchParams.sort)) {
    listings = [...listings].sort((a, b) => {
      const discountA = a.id != null ? maxDiscountByListingId[a.id] || 0 : 0;
      const discountB = b.id != null ? maxDiscountByListingId[b.id] || 0 : 0;
      return compareSearchRankThenIds(
        a as Record<string, unknown> & { id?: number | null },
        b as Record<string, unknown> & { id?: number | null },
        resolvedSearchParams.search,
        discountB - discountA,
      );
    });
  }

  if (
    resolvedSearchParams.search &&
    resolvedSearchParams.sort !== "distance" &&
    !sortRequiresDeals(resolvedSearchParams.sort)
  ) {
    listings = stableReorderBySearchRank(listings, resolvedSearchParams.search);
  }

  // Also fetch featured listings separately for the carousel (usually small count)
  const { data: featuredData } = await publicSupabase
    .from("listings_with_details")
    .select("*")
    .eq("status", "published")
    .eq("is_featured", true)
    .in("category_name", categoryNamesForFilter)
    .order("avg_rating", { ascending: false })
    .limit(20);

  const featuredRaw = featuredData || [];

  // Fetch images only for first page + featured listings (much faster than all 792!)
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
    distance_meters?: number;
  };

  // Combine unique listing IDs from both sets
  const allListingIds = new Set([
    ...listings.filter((l) => l.id !== null).map((l) => l.id as number),
    ...featuredRaw.filter((l) => l.id !== null).map((l) => l.id as number),
  ]);
  const listingIds = Array.from(allListingIds);

  const imagesMap: Record<number, ListingWithImages["images"]> = {};

  if (listingIds.length > 0) {
    const { data: allImages } = await publicSupabase
      .from("listing_images")
      .select("*")
      .in("listing_id", listingIds)
      .order("display_order", { ascending: true });

    if (Array.isArray(allImages)) {
      allImages.forEach((img) => {
        if (!imagesMap[img.listing_id]) {
          imagesMap[img.listing_id] = [];
        }
        imagesMap[img.listing_id]!.push(img);
      });
    }
  }

  // Enrich listings with images
  const enrichedListings = listings
    .filter((listing) => listing.id !== null)
    .map((listing) => ({
      ...listing,
      images: listing.id ? imagesMap[listing.id] || [] : [],
    })) as ListingWithImages[];

  // Enrich featured listings with images
  const enrichedFeatured = featuredRaw
    .filter((listing) => listing.id !== null)
    .map((listing) => ({
      ...listing,
      images: listing.id ? imagesMap[listing.id] || [] : [],
    })) as ListingWithImages[];

  // Fetch categories for the header
  const { data: categoriesData } = await publicSupabase
    .from("categories")
    .select("id, name, slug, parent_id, icon_name")
    .eq("is_enabled", true)
    .eq("show_in_filters", true)
    .in("category_type", ["listing", "both"])
    .neq("slug", "events")
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(200);

  // Compute page title and description on server side to avoid hydration issues
  type Cat = {
    id: number;
    name: string;
    slug: string;
    parent_id?: number | null;
  };
  const getCategoryContent = (
    currentCategory: Cat | null,
    categories: Cat[],
  ) => {
    if (!currentCategory || currentCategory.slug === "all") {
      return {
        title: "Discover Karachi",
        description:
          "Explore the best of Karachi — from local favorites to hidden gems, all in one place.",
      };
    }

    // Define category-specific content for main categories
    const categoryContent: Record<
      string,
      { title: string; description: string }
    > = {
      "eat-drink": {
        title: "Best Restaurants in Karachi",
        description:
          "Discover Karachi's finest dining experiences — from street food gems to upscale restaurants, find your perfect meal.",
      },
      events: {
        title: "Events & Tickets in Karachi",
        description:
          "Find and book tickets for the hottest events, concerts, and experiences happening in Karachi.",
      },
      "where-to-stay": {
        title: "Hotels & Accommodation in Karachi",
        description:
          "Find the perfect place to stay in Karachi — from luxury hotels to budget-friendly options and unique stays.",
      },
      "guides-reviews": {
        title: "Karachi Guides & Reviews",
        description:
          "Expert guides, honest reviews, and insider tips to help you make the most of your time in Karachi.",
      },
      "fitness-healthcare": {
        title: "Fitness & Healthcare in Karachi",
        description:
          "Find gyms, wellness centers, hospitals, and healthcare services to keep you healthy and active in Karachi.",
      },
      education: {
        title: "Educational Institutions in Karachi",
        description:
          "Discover schools, universities, and learning centers offering quality education across Karachi.",
      },
      entertainment: {
        title: "Entertainment & Fun in Karachi",
        description:
          "Find the best entertainment venues, gaming centers, cinemas, and fun activities for all ages in Karachi.",
      },
      shopping: {
        title: "Shopping in Karachi",
        description:
          "Explore Karachi's shopping scene — from modern malls to traditional bazaars and specialty stores.",
      },
      "things-to-do": {
        title: "Things to Do in Karachi",
        description:
          "Discover attractions, activities, and experiences that make Karachi special — from beaches to cultural sites.",
      },
    };

    // For subcategories, find the parent category
    let targetCategory = currentCategory;
    if (currentCategory.parent_id) {
      const parentCategory = categories.find(
        (cat) => cat.id === currentCategory.parent_id,
      );
      if (parentCategory) {
        targetCategory = parentCategory;
      }
    }

    // Get content for the target category (main category or parent of subcategory)
    const content = categoryContent[targetCategory.slug];
    if (content) {
      // If it's a subcategory, customize the title to include the subcategory name
      if (
        currentCategory.parent_id &&
        currentCategory.slug !== targetCategory.slug
      ) {
        return {
          title: `${currentCategory.name} in Karachi`,
          description: content.description,
        };
      }
      return content;
    }

    // Fallback for any categories not defined above
    return {
      title: `${currentCategory.name} in Karachi`,
      description: `Discover the best ${currentCategory.name.toLowerCase()} options in Karachi. Find exactly what you're looking for.`,
    };
  };

  const { title: pageTitle, description: pageDescription } = getCategoryContent(
    category,
    categoriesData || [],
  );

  // Process grid listings (first page only, featured already excluded at query level)
  let gridListings = enrichedListings.filter(
    (l): l is ListingWithImages & { id: number } => l.id !== null,
  );

  // Process featured listings for carousel (separate query)
  let featuredListings = enrichedFeatured.filter(
    (l): l is ListingWithImages & { id: number } => l.id !== null,
  );

  // Hydrate favorite flags server-side for the current user to avoid client round-trips
  try {
    const { getFavoritedListingIdsForUser } =
      await import("@/lib/utils/favorites-server");
    // Combine IDs from both sets
    const allIds = [
      ...gridListings.map((l) => l.id),
      ...featuredListings.map((l) => l.id),
    ];
    const favSet = await getFavoritedListingIdsForUser(userSupabase, allIds);
    gridListings = gridListings.map((l) => ({
      ...l,
      favorited: favSet.has(l.id),
    }));
    featuredListings = featuredListings.map((l) => ({
      ...l,
      favorited: favSet.has(l.id),
    }));
  } catch (err) {
    console.error("Failed to hydrate favorites for category page", err);
  }

  // Conform to PremiumListingsGrid expected searchParams shape
  const gridSearchParams = buildGridSearchParams(
    {
      search: resolvedSearchParams.search,
      sort: resolvedSearchParams.sort,
      rating: resolvedSearchParams.rating,
      sub: resolvedSearchParams.sub,
      deals: resolvedSearchParams.deals,
      bank: resolvedSearchParams.bank,
      card: resolvedSearchParams.card,
      open_now: resolvedSearchParams.open_now,
      near: resolvedSearchParams.near,
      lat: resolvedSearchParams.lat,
      lng: resolvedSearchParams.lng,
    },
    slug,
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
        currentCategory={category}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
      />

      <div className="container mx-auto px-6 lg:px-8 py-12 space-y-12">
        {/* Featured Listings Carousel - Category-specific featured listings */}
        {featuredListings.length > 0 && !resolvedSearchParams.search && (
          <FeaturedListingsCarousel featuredListings={featuredListings} />
        )}

        {/* Main Listings Grid - only first page from server, rest via API */}
        <div>
          <PremiumListingsGrid
            listings={gridListings}
            totalCount={totalCount || 0}
            excludeFeaturedFromApi={true}
            searchParams={gridSearchParams}
          />
        </div>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: CategoryListingsPageProps) {
  // Use createClient at build time (no cookies needed for public data)
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { slug } = await params;

  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("slug", slug)
    .single();

  if (!category) {
    return {
      title: "Category Not Found",
    };
  }

  return {
    title: `${category.name} in Karachi - Inside Karachi`,
    description: `Discover the best ${category.name.toLowerCase()} in Karachi. Browse listings, read reviews, and find everything you need in Karachi.`,
  };
}
