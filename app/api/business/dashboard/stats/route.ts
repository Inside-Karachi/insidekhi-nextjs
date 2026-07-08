import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  verifyBusinessOwner,
  apiSuccess,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import type { BusinessOwnerDashboardStats } from "@/types/business-owner.types";

/**
 * GET /api/business/dashboard/stats
 * Get dashboard statistics for business owner
 */
export async function GET(_request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();

    // Get listings count by status
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("status")
      .eq("owner_id", userId);

    if (listingsError) {
      throw new Error(`Failed to fetch listings: ${listingsError.message}`);
    }

    const total_listings = listings?.length || 0;
    const active_listings =
      listings?.filter((l: { status: string }) => l.status === "published")
        .length || 0;
    const draft_listings =
      listings?.filter((l: { status: string }) => l.status === "draft")
        .length || 0;
    const pending_approvals =
      listings?.filter(
        (l: { status: string }) => l.status === "pending_approval",
      ).length || 0;

    // Get 30-day analytics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analytics, error: analyticsError } = await supabase
      .from("business_owner_analytics_cache")
      .select("total_views, avg_rating, total_reviews")
      .eq("owner_id", userId)
      .gte("metric_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (analyticsError) {
      console.error("Analytics error:", analyticsError);
    }

    const total_views_30d =
      analytics?.reduce(
        (sum: number, a) => sum + ((a.total_views as number) || 0),
        0,
      ) || 0;

    // Calculate average rating across all listings
    type AnalyticsRow = {
      metric_date: string | Date;
      avg_rating: number | null;
      total_reviews: number | null;
    };
    const latestAnalytics = (analytics as unknown as AnalyticsRow[])?.filter(
      (a) => {
        const date = new Date(a.metric_date);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return date >= yesterday;
      },
    );

    const avg_rating =
      latestAnalytics && latestAnalytics.length > 0
        ? latestAnalytics.reduce(
            (sum: number, a) => sum + ((a.avg_rating as number) || 0),
            0,
          ) / latestAnalytics.length
        : 0;

    const total_reviews =
      latestAnalytics?.reduce(
        (sum: number, a) => sum + ((a.total_reviews as number) || 0),
        0,
      ) || 0;

    // Get change requests status
    const { data: changeRequests, error: changeRequestsError } = await supabase
      .from("listing_change_requests")
      .select("status, sla_deadline")
      .eq("requested_by", userId)
      .eq("status", "pending");

    if (changeRequestsError) {
      console.error("Change requests error:", changeRequestsError);
    }

    const pending_change_requests = changeRequests?.length || 0;
    const overdue_change_requests =
      changeRequests?.filter((cr: { sla_deadline: string | null }) => {
        return cr.sla_deadline && new Date(cr.sla_deadline) < new Date();
      }).length || 0;

    const stats: BusinessOwnerDashboardStats = {
      total_listings,
      active_listings,
      draft_listings,
      pending_approvals,
      total_views_30d,
      total_reviews,
      avg_rating: Math.round(avg_rating * 100) / 100,
      pending_change_requests,
      overdue_change_requests,
    };

    return apiSuccess(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
