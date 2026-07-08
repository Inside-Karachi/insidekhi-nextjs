import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    // Use regular supabase client for authentication
    const supabase = await createServerSupabase();

    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Use service role client for admin operations to bypass RLS
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get user profile with role using service role
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
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

    // Get comprehensive dashboard statistics using service role
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: totalEvents },
      { count: publishedEvents },
      { count: totalListings },
      { count: activeListings },
      { count: totalReviews },
      { count: pendingReviews },
      // Comment statistics
      { count: totalComments },
      { count: pendingComments },
      { count: approvedComments },
      { count: rejectedComments },
      { count: flaggedComments },
    ] = await Promise.all([
      // Total users
      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true }),

      // Active users (created in last 30 days)
      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        ),

      // Total events
      adminSupabase.from("events").select("*", { count: "exact", head: true }),

      // Published events
      adminSupabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),

      // Total listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true }),

      // Active listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),

      // Total reviews
      adminSupabase.from("reviews").select("*", { count: "exact", head: true }),

      // Pending reviews (if there's a status field)
      adminSupabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("rating", 0), // Assuming 0 rating means pending

      // Comment statistics
      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true }),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved"),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected"),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "flagged"),
    ]);

    // Get recent activity using service role
    const { data: recentUsers } = await adminSupabase
      .from("profiles")
      .select("id, full_name, created_at, role")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentEvents } = await adminSupabase
      .from("events")
      .select("id, name, created_at, status")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentListings } = await adminSupabase
      .from("listings")
      .select("id, name, created_at, status")
      .order("created_at", { ascending: false })
      .limit(5);

    // Calculate growth metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      { count: usersThisMonth },
      { count: eventsThisMonth },
      { count: listingsThisMonth },
      { count: usersThisWeek },
      { count: eventsThisWeek },
      { count: listingsThisWeek },
    ] = await Promise.all([
      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),

      adminSupabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),

      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),

      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),

      adminSupabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),

      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),
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
          users: recentUsers || [],
          events: recentEvents || [],
          listings: recentListings || [],
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
