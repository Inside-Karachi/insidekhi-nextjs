import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

const countQuery = async (sql: string, params: unknown[] = []): Promise<number> => {
  const { rows } = await query(sql, params);
  return parseInt(rows[0]?.count ?? "0", 10);
};

export async function GET() {
  try {
    // Check admin authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile with role
    const { rows: profileRows } = await query(
      "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check admin role
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const thirtyDaysAgoIso = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const sevenDaysAgoIso = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Get comprehensive dashboard statistics
    const [
      totalUsers,
      activeUsers,
      totalEvents,
      publishedEvents,
      totalListings,
      activeListings,
      totalReviews,
      pendingReviews,
      totalComments,
      pendingComments,
      approvedComments,
      rejectedComments,
      flaggedComments,
      usersThisMonth,
      eventsThisMonth,
      listingsThisMonth,
      usersThisWeek,
      eventsThisWeek,
      listingsThisWeek,
    ] = await Promise.all([
      // Total users
      countQuery(`SELECT COUNT(*) FROM public.profiles`),

      // Active users (created in last 30 days)
      countQuery(
        `SELECT COUNT(*) FROM public.profiles WHERE created_at >= $1`,
        [thirtyDaysAgoIso]
      ),

      // Total events
      countQuery(`SELECT COUNT(*) FROM public.events`),

      // Published events
      countQuery(
        `SELECT COUNT(*) FROM public.events WHERE status = 'published'`
      ),

      // Total listings
      countQuery(`SELECT COUNT(*) FROM public.listings`),

      // Active listings
      countQuery(
        `SELECT COUNT(*) FROM public.listings WHERE status = 'published'`
      ),

      // Total reviews
      countQuery(`SELECT COUNT(*) FROM public.reviews`),

      // Pending reviews (assuming 0 rating means pending)
      countQuery(`SELECT COUNT(*) FROM public.reviews WHERE rating = 0`),

      // Comment statistics
      countQuery(`SELECT COUNT(*) FROM public.review_comments`),
      countQuery(
        `SELECT COUNT(*) FROM public.review_comments WHERE status = 'pending'`
      ),
      countQuery(
        `SELECT COUNT(*) FROM public.review_comments WHERE status = 'approved'`
      ),
      countQuery(
        `SELECT COUNT(*) FROM public.review_comments WHERE status = 'rejected'`
      ),
      countQuery(
        `SELECT COUNT(*) FROM public.review_comments WHERE status = 'flagged'`
      ),

      // Growth metrics - this month
      countQuery(
        `SELECT COUNT(*) FROM public.profiles WHERE created_at >= $1`,
        [thirtyDaysAgoIso]
      ),
      countQuery(
        `SELECT COUNT(*) FROM public.events WHERE created_at >= $1`,
        [thirtyDaysAgoIso]
      ),
      countQuery(
        `SELECT COUNT(*) FROM public.listings WHERE created_at >= $1`,
        [thirtyDaysAgoIso]
      ),

      // Growth metrics - this week
      countQuery(
        `SELECT COUNT(*) FROM public.profiles WHERE created_at >= $1`,
        [sevenDaysAgoIso]
      ),
      countQuery(`SELECT COUNT(*) FROM public.events WHERE created_at >= $1`, [
        sevenDaysAgoIso,
      ]),
      countQuery(
        `SELECT COUNT(*) FROM public.listings WHERE created_at >= $1`,
        [sevenDaysAgoIso]
      ),
    ]);

    // Get recent activity
    const [recentUsersResult, recentEventsResult, recentListingsResult] =
      await Promise.all([
        query(
          `SELECT id, full_name, created_at, role FROM public.profiles
           ORDER BY created_at DESC LIMIT 5`
        ),
        query(
          `SELECT id, name, created_at, status FROM public.events
           ORDER BY created_at DESC LIMIT 5`
        ),
        query(
          `SELECT id, name, created_at, status FROM public.listings
           ORDER BY created_at DESC LIMIT 5`
        ),
      ]);

    const dashboardData = {
      success: true,
      data: {
        statistics: {
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          totalEvents: totalEvents || 0,
          publishedEvents: publishedEvents || 0,
          totalListings: totalListings || 0,
          activeListings: activeListings || 0,
          totalReviews: totalReviews || 0,
          pendingReviews: pendingReviews || 0,
          // Comment statistics
          totalComments: totalComments || 0,
          pendingComments: pendingComments || 0,
          approvedComments: approvedComments || 0,
          rejectedComments: rejectedComments || 0,
          flaggedComments: flaggedComments || 0,
        },
        growth: {
          usersThisMonth: usersThisMonth || 0,
          eventsThisMonth: eventsThisMonth || 0,
          listingsThisMonth: listingsThisMonth || 0,
          usersThisWeek: usersThisWeek || 0,
          eventsThisWeek: eventsThisWeek || 0,
          listingsThisWeek: listingsThisWeek || 0,
        },
        recentActivity: {
          users: recentUsersResult.rows || [],
          events: recentEventsResult.rows || [],
          listings: recentListingsResult.rows || [],
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Admin dashboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard data",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
