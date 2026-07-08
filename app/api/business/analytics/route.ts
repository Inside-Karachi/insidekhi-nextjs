import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  verifyBusinessOwner,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import type { BusinessOwnerAnalytics } from "@/types/business-owner.types";

export const dynamic = "force-dynamic";

type Granularity = "day" | "week" | "month";

type ListingRow = {
  id: number;
  name: string;
};

type CacheRow = {
  listing_id: number;
  metric_date: string;
  total_views: number | null;
  unique_visitors: number | null;
  favorites: number | null;
  contact_clicks: number | null;
  avg_rating: number | null;
  total_reviews: number | null;
};

type BranchRow = {
  id: number;
  listing_id: number;
  name: string;
};

type ReviewRow = {
  branch_id: number;
  rating: number;
};

function getBucketDate(dateString: string, granularity: Granularity): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  if (granularity === "month") {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  }

  if (granularity === "week") {
    const day = date.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + diffToMonday);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${dayOfMonth}`;
  }

  return dateString;
}

function parseGranularity(value: string | null): Granularity {
  if (value === "week" || value === "month") {
    return value;
  }
  return "day";
}

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const timezone = searchParams.get("timezone") || "Asia/Karachi";
    const granularity = parseGranularity(searchParams.get("granularity"));

    if (!startDate || !endDate) {
      return apiError("startDate and endDate are required", 400);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return apiError("Invalid date format", 400);
    }

    if (start > end) {
      return apiError("startDate must be before endDate", 400);
    }

    const parsedListingId = listingId ? Number.parseInt(listingId, 10) : undefined;
    if (
      listingId &&
      (parsedListingId === undefined ||
        !Number.isInteger(parsedListingId) ||
        parsedListingId <= 0)
    ) {
      return apiError("Invalid listingId", 400);
    }

    // Get user's listings to verify ownership and resolve names for top listings.
    const { data: userListings, error: listingsError } = await supabase
      .from("listings")
      .select("id, name")
      .eq("owner_id", userId);

    if (listingsError) {
      throw new Error(
        `Failed to fetch user listings: ${listingsError.message}`,
      );
    }

    const userListingRows = (userListings ?? []) as unknown as ListingRow[];
    const userListingIds = userListingRows.map((listing) => listing.id);
    const listingNameById = new Map<number, string>(
      userListingRows.map((listing) => [listing.id, listing.name]),
    );

    if (userListingIds.length === 0) {
      // User has no listings - return empty analytics
      return apiSuccess<BusinessOwnerAnalytics>({
        timezone,
        granularity,
        summary: {
          totalViews: 0,
          uniqueVisitors: 0,
          avgRating: 0,
          totalReviews: 0,
          favorites: 0,
          contactClicks: 0,
        },
        timeseries: [],
        branches: [],
        topListings: [],
      });
    }

    // If listingId is provided, verify ownership
    if (parsedListingId && !userListingIds.includes(parsedListingId)) {
      return apiError("You do not own this listing", 403);
    }

    const targetListingIds = parsedListingId ? [parsedListingId] : userListingIds;

    const { data: cacheRowsData, error: cacheError } = await supabase
      .from("business_owner_analytics_cache")
      .select(
        "listing_id, metric_date, total_views, unique_visitors, favorites, contact_clicks, avg_rating, total_reviews",
      )
      .eq("owner_id", userId)
      .in("listing_id", targetListingIds)
      .gte("metric_date", startDate)
      .lte("metric_date", endDate)
      .order("metric_date", { ascending: true });

    if (cacheError) {
      throw new Error(
        `Failed to fetch analytics metrics: ${cacheError.message}`,
      );
    }

    const cacheRows = (cacheRowsData ?? []) as unknown as CacheRow[];

    let totalViews = 0;
    let uniqueVisitors = 0;
    let favorites = 0;
    let contactClicks = 0;
    let totalReviews = 0;
    let weightedRatings = 0;

    const timeseriesMap = new Map<
      string,
      {
        views: number;
        visitors: number;
        favorites: number;
        contactClicks: number;
      }
    >();

    const listingAggregateMap = new Map<
      number,
      {
        views: number;
        reviews: number;
        ratingWeightedSum: number;
      }
    >();

    for (const row of cacheRows) {
      const rowViews = Number(row.total_views ?? 0);
      const rowVisitors = Number(row.unique_visitors ?? 0);
      const rowFavorites = Number(row.favorites ?? 0);
      const rowContactClicks = Number(row.contact_clicks ?? 0);
      const rowAvgRating = Number(row.avg_rating ?? 0);
      const rowTotalReviews = Number(row.total_reviews ?? 0);

      totalViews += rowViews;
      uniqueVisitors += rowVisitors;
      favorites += rowFavorites;
      contactClicks += rowContactClicks;
      totalReviews += rowTotalReviews;
      weightedRatings += rowAvgRating * rowTotalReviews;

      const bucket = getBucketDate(row.metric_date, granularity);
      const existingTimeseries = timeseriesMap.get(bucket) ?? {
        views: 0,
        visitors: 0,
        favorites: 0,
        contactClicks: 0,
      };
      existingTimeseries.views += rowViews;
      existingTimeseries.visitors += rowVisitors;
      existingTimeseries.favorites += rowFavorites;
      existingTimeseries.contactClicks += rowContactClicks;
      timeseriesMap.set(bucket, existingTimeseries);

      const existingListingAggregate = listingAggregateMap.get(row.listing_id) ?? {
        views: 0,
        reviews: 0,
        ratingWeightedSum: 0,
      };
      existingListingAggregate.views += rowViews;
      existingListingAggregate.reviews += rowTotalReviews;
      existingListingAggregate.ratingWeightedSum += rowAvgRating * rowTotalReviews;
      listingAggregateMap.set(row.listing_id, existingListingAggregate);
    }

    const timeseries = Array.from(timeseriesMap.entries())
      .map(([date, values]) => ({
        date,
        views: values.views,
        visitors: values.visitors,
        favorites: values.favorites,
        contactClicks: values.contactClicks,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let branches: BusinessOwnerAnalytics["branches"] = [];
    if (targetListingIds.length > 0) {
      const serviceSupabase = await createServerSupabase({ useServiceRole: true });

      const { data: branchRowsData, error: branchRowsError } = await serviceSupabase
        .from("listing_branches")
        .select("id, listing_id, name")
        .in("listing_id", targetListingIds);

      if (!branchRowsError && branchRowsData && branchRowsData.length > 0) {
        const branchRows = branchRowsData as unknown as BranchRow[];
        const branchIds = branchRows.map((branch) => branch.id);

        const { data: reviewRowsData, error: reviewRowsError } = await serviceSupabase
          .from("reviews")
          .select("branch_id, rating")
          .in("branch_id", branchIds)
          .eq("status", "approved")
          .gte("created_at", `${startDate}T00:00:00.000Z`)
          .lte("created_at", `${endDate}T23:59:59.999Z`);

        const reviewRows = reviewRowsError
          ? []
          : ((reviewRowsData ?? []) as unknown as ReviewRow[]);

        const ratingsByBranch = new Map<
          number,
          {
            ratingsTotal: number;
            reviews: number;
          }
        >();

        for (const review of reviewRows) {
          const existing = ratingsByBranch.get(review.branch_id) ?? {
            ratingsTotal: 0,
            reviews: 0,
          };
          existing.ratingsTotal += Number(review.rating ?? 0);
          existing.reviews += 1;
          ratingsByBranch.set(review.branch_id, existing);
        }

        branches = branchRows.map((branch) => {
          const branchMetrics = ratingsByBranch.get(branch.id);
          return {
            branchId: branch.id,
            branchName: branch.name,
            views: 0,
            avgRating:
              branchMetrics && branchMetrics.reviews > 0
                ? branchMetrics.ratingsTotal / branchMetrics.reviews
                : 0,
            reviews: branchMetrics?.reviews ?? 0,
          };
        });

        branches.sort((a, b) => b.reviews - a.reviews);
      }
    }

    const topListings = parsedListingId
      ? []
      : Array.from(listingAggregateMap.entries())
          .map(([id, aggregate]) => ({
            listingId: id,
            listingName: listingNameById.get(id) ?? `Listing #${id}`,
            views: aggregate.views,
            rating:
              aggregate.reviews > 0
                ? aggregate.ratingWeightedSum / aggregate.reviews
                : 0,
            reviews: aggregate.reviews,
          }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 5);

    const analytics: BusinessOwnerAnalytics = {
      timezone,
      granularity,
      summary: {
        totalViews,
        uniqueVisitors,
        avgRating: totalReviews > 0 ? weightedRatings / totalReviews : 0,
        totalReviews,
        favorites,
        contactClicks,
      },
      timeseries,
      branches,
      topListings,
    };

    return apiSuccess(analytics);
  } catch (error) {
    return handleApiError(error);
  }
}
