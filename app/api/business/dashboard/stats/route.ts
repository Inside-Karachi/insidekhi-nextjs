import { NextRequest } from "next/server";
import { query } from "@/lib/db";
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

    // Get listings count by status
    let listings;
    try {
      const result = await query(
        `SELECT status FROM listings WHERE owner_id = $1`,
        [userId],
      );
      listings = result.rows;
    } catch (listingsError) {
      throw new Error(
        `Failed to fetch listings: ${listingsError instanceof Error ? listingsError.message : "Unknown error"}`,
      );
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

    let analytics;
    try {
      const result = await query(
        `SELECT total_views, avg_rating, total_reviews
         FROM business_owner_analytics_cache
         WHERE owner_id = $1 AND metric_date >= $2`,
        [userId, thirtyDaysAgo.toISOString().split("T")[0]],
      );
      analytics = result.rows;
    } catch (analyticsError) {
      console.error("Analytics error:", analyticsError);
      analytics = undefined;
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
    let changeRequests: { status: string; sla_deadline: string | null }[] | undefined =
      undefined;
    try {
      const result = await query(
        `SELECT status, sla_deadline FROM listing_change_requests
         WHERE requested_by = $1 AND status = 'pending'`,
        [userId],
      );
      changeRequests = result.rows;
    } catch (changeRequestsError) {
      console.error("Change requests error:", changeRequestsError);
      changeRequests = undefined;
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
