import { createServerSupabase } from "@/lib/supabase/server";
import { getFriendlyActivityName } from "@/lib/gamification";

import { redirect } from "next/navigation";
import { PremiumDashboardHero } from "@/components/dashboard/PremiumDashboardHero";
import { AdvancedStatsGrid } from "@/components/dashboard/AdvancedStatsGrid";
import { PremiumInsightsPanel } from "@/components/dashboard/PremiumInsightsPanel";
import { PremiumQuickActions } from "@/components/dashboard/PremiumQuickActions";
import { PremiumBottomSection } from "@/components/dashboard/PremiumBottomSection";
import { InviteShareDashboardSection } from "@/components/dashboard/InviteShareDashboardSection";
import { cookies } from "next/headers";

// Force dynamic rendering to ensure fresh data on every request
export const dynamic = "force-dynamic";

// TypeScript interfaces for proper typing
interface FavoriteActivity {
  user_id: string;
  listing_id: number;
  created_at: string;
  listing?: {
    name: string;
    slug: string;
    address?: string | null;
  };
}

interface AchievementActivity {
  user_id: string;
  badge_id: number;
  awarded_at: string;
  badge?: {
    name: string;
    description?: string | null;
    icon_url?: string | null;
  };
}
interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  listing?: {
    name: string;
    slug: string;
  };
}

interface BookingItem {
  quantity: number;
  ticket_type?: {
    name: string;
    event?: {
      name: string;
      slug: string;
      start_time: string;
    };
  };
}

interface Booking {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  booking_items?: BookingItem[];
}

interface PointsActivity {
  id: number;
  points: number;
  reason: string | null;
  created_at: string;
}

interface ActivityItem {
  type: "points" | "review" | "booking" | "favorite" | "achievement";
  content: string;
  time: string;
  points?: number;
  rating?: number;
  amount?: number;
  location?: string;
}

interface MinimalListing {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
  reviews?: { rating: number }[] | null;
}

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  listing?: {
    name: string;
    slug: string;
  };
}

export default async function DashboardPage() {
  const supabase = await createServerSupabase();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Parallel fetch: Profile and initial required data
  const [profileResponse, ranksDataResponse] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        `
        *,
        reviews!reviews_user_id_fkey(count),
        bookings:bookings(count),
        favorites:favorite_listings(count)
      `,
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("user_ranks")
      .select(
        `
        rank:ranks(
          id,
          name,
          slug,
          color,
          min_xp_required
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("current_rank", true)
      .single(),
  ]);

  const { data: profile, error: profileError } = profileResponse;
  const { data: ranksData } = ranksDataResponse;

  if (profileError) {
    console.error("Failed to load profile for dashboard:", profileError);
    // If profile loading fails, redirect to login
    redirect("/login");
  }

  // Use active_role to determine which dashboard to show
  // Staff switched to public_user will see the public dashboard
  const activeRole = profile?.active_role || profile?.role;

  // Check user type based on ACTIVE ROLE (not permanent role)
  const isAdmin = activeRole === "admin" || activeRole === "super_admin";
  const isLister = activeRole === "lister";
  const isOrganizer = activeRole === "organizer";
  const isBusinessOwner = activeRole === "business_owner";

  // Show appropriate dashboard based on ACTIVE user role
  if (isAdmin) {
    if (activeRole === "super_admin") {
      const { SuperAdminDashboardWrapper } =
        await import("@/components/dashboard/SuperAdminDashboardWrapper");
      return <SuperAdminDashboardWrapper user={user} profile={profile} />;
    }
    const { AdminDashboard } =
      await import("@/components/dashboard/AdminDashboard");
    return <AdminDashboard user={user} profile={profile} />;
  }

  // Show organizer dashboard for organizer users
  if (isOrganizer) {
    const { OrganizerDashboard } =
      await import("@/components/dashboard/OrganizerDashboard");
    return <OrganizerDashboard user={user} profile={profile} />;
  }

  // Show business owner dashboard for business owner users
  if (isBusinessOwner) {
    const { BusinessOwnerDashboard } =
      await import("@/components/business-owner/BusinessOwnerDashboard");
    return <BusinessOwnerDashboard user={user} profile={profile} />;
  }

  // Show lister dashboard for lister users
  if (isLister) {
    const cookieStore = await cookies();
    // ... (Lister logic remains same, it was already somewhat isolated)
    // Use admin dashboard API to get platform-wide statistics
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/api/admin/dashboard`,
      {
        headers: {
          Cookie: cookieStore.toString(),
        },
        cache: "no-store",
      },
    );

    let dashboardData;

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        dashboardData = {
          statistics: result.data.statistics,
          recentActivity: result.data.recentActivity,
        };
      }
    }

    if (!dashboardData) {
      // Create admin client to bypass RLS for platform-wide stats
      const { createServerSupabase: createAdminSupabase } =
        await import("@/lib/supabase/server");
      const adminSupabase = await createAdminSupabase({ useServiceRole: true });

      // Get platform-wide statistics
      const [
        { count: totalListingsCount },
        { count: activeListingsCount },
        { count: totalEventsCount },
        { count: publishedEventsCount },
        { count: totalReviewsCount },
        { count: pendingReviewsCount },
        { count: totalUsersCount },
        { count: activeUsersCount },
        { data: recentListings },
        { data: recentEvents },
      ] = await Promise.all([
        adminSupabase
          .from("listings")
          .select("*", { count: "exact", head: true }),
        adminSupabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("status", "published"),
        adminSupabase
          .from("events")
          .select("*", { count: "exact", head: true }),
        adminSupabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("status", "published"),
        adminSupabase
          .from("reviews")
          .select("*", { count: "exact", head: true }),
        adminSupabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        adminSupabase
          .from("profiles")
          .select("*", { count: "exact", head: true }),
        adminSupabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte(
            "created_at",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          ),
        adminSupabase
          .from("listings")
          .select("id, name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        adminSupabase
          .from("events")
          .select("id, name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      dashboardData = {
        statistics: {
          totalUsers: totalUsersCount || 0,
          activeUsers: activeUsersCount || 0,
          totalEvents: totalEventsCount || 0,
          publishedEvents: publishedEventsCount || 0,
          totalListings: totalListingsCount || 0,
          activeListings: activeListingsCount || 0,
          totalReviews: totalReviewsCount || 0,
          pendingReviews: pendingReviewsCount || 0,
          totalComments: 0,
          pendingComments: 0,
          approvedComments: 0,
          rejectedComments: 0,
          flaggedComments: 0,
        },
        recentActivity: {
          users: [],
          events:
            recentEvents?.map((e) => ({
              id: e.id,
              name: e.name || `Event ${e.id}`,
              created_at: e.created_at,
              status: e.status,
            })) || [],
          listings:
            recentListings?.map((l) => ({
              id: l.id,
              name: l.name || `Listing ${l.id}`,
              created_at: l.created_at,
              status: l.status,
            })) || [],
        },
      };
    }

    const { ListerDashboard } =
      await import("@/components/dashboard/ListerDashboard");
    return (
      <ListerDashboard
        user={user}
        profile={profile}
        dashboardData={dashboardData}
      />
    );
  }

  // Calculate dates for insights
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const previousWeekStart = new Date();
  previousWeekStart.setDate(previousWeekStart.getDate() - 14);
  const previousWeekEnd = new Date();
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

  const fetchUpcomingEvents = async () => {
    const baseQuery = supabase
      .from("events")
      .select(`id, name, slug, start_time, listing:listings(name, address)`)
      .eq("status", "published")
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(2);

    const { data, error } = await baseQuery;
    if (
      error &&
      (error.code === "42501" ||
        error.message?.includes("is_business_owner") ||
        error.message?.includes("is_staff"))
    ) {
      // Fallback for environments where function grants behind event RLS are incomplete.
      const serviceSupabase = await createServerSupabase({
        useServiceRole: true,
      });
      return serviceSupabase
        .from("events")
        .select(`id, name, slug, start_time, listing:listings(name, address)`)
        .eq("status", "published")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(2);
    }

    return { data, error };
  };

  // Parallel fetch: All user dashboard data
  const [
    pointsActivityResponse,
    userReviewsResponse,
    userFavoritesActivityResponse,
    userAchievementsResponse,
    userBookingsResponse,
    weeklyReviewsResponse,
    weeklyBookingsResponse,
    weeklyPointsResponse,
    userBadgesResponse,
    userFavoritesResponse,
    upcomingEventsResponse,
    allRanksResponse,
    streakDataResponse,
    previousWeekPointsResponse,
  ] = await Promise.all([
    // 1. Points Log
    supabase
      .from("points_log")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    // 2. Reviews
    supabase
      .from("reviews")
      .select(`id, rating, comment, created_at, listing:listings(name, slug)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    // 3. Favorites Activity
    supabase
      .from("favorite_listings")
      .select(
        `user_id, listing_id, created_at, listing:listings(name, slug, address)`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    // 4. Achievements Activity
    supabase
      .from("user_badges")
      .select(
        `user_id, badge_id, awarded_at, badge:badges(name, description, icon_url)`,
      )
      .eq("user_id", user.id)
      .order("awarded_at", { ascending: false })
      .limit(3),
    // 5. Bookings
    supabase
      .from("bookings")
      .select(
        `
        id, total_amount, status, created_at,
        booking_items(quantity, ticket_type:ticket_types(name, event:events(name, slug, start_time)))
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    // 6. Weekly Reviews
    supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo.toISOString()),
    // 7. Weekly Bookings
    supabase
      .from("bookings")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo.toISOString()),
    // 8. Weekly Points
    supabase
      .from("points_log")
      .select("points")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo.toISOString()),
    // 9. User Badges (Full List)
    supabase
      .from("user_badges")
      .select(`badge:badges(*)`)
      .eq("user_id", user.id)
      .order("awarded_at", { ascending: false }),
    // 10. User Favorites (For Recommendations)
    supabase
      .from("favorite_listings")
      .select("listing:listings(category_id)")
      .eq("user_id", user.id)
      .limit(5),
    // 11. Upcoming Events (General)
    fetchUpcomingEvents(),
    // 12. All Ranks
    supabase
      .from("ranks")
      .select("id, name, slug, color, min_xp_required")
      .eq("is_active", true)
      .order("min_xp_required", { ascending: true }),
    // 13. Streak Data
    supabase
      .from("daily_login_streaks")
      .select("current_streak")
      .eq("user_id", user.id)
      .single(),
    // 14. Previous Week Points
    supabase
      .from("points_log")
      .select("points")
      .eq("user_id", user.id)
      .gte("created_at", previousWeekStart.toISOString())
      .lt("created_at", previousWeekEnd.toISOString()),
  ]);

  // Extract Data from Responses
  const { data: pointsActivity } = pointsActivityResponse;
  const { data: userReviews } = userReviewsResponse;
  const { data: userFavoritesActivity } = userFavoritesActivityResponse;
  const { data: userAchievements } = userAchievementsResponse;
  const { data: userBookings } = userBookingsResponse;
  const { data: weeklyReviews } = weeklyReviewsResponse;
  const { data: weeklyBookings } = weeklyBookingsResponse;
  const { data: weeklyPoints } = weeklyPointsResponse;
  const { data: userBadges } = userBadgesResponse;
  const { data: userFavorites } = userFavoritesResponse;
  const { data: upcomingEvents } = upcomingEventsResponse;
  const { data: allRanks } = allRanksResponse;
  const { data: streakData } = streakDataResponse;
  const { data: previousWeekPoints } = previousWeekPointsResponse;

  // --- Process Data & Derived State ---

  // Compute total events booked
  const eventsBookedTotal = (userBookings || []).reduce((sum, booking) => {
    const count = (booking.booking_items || []).filter(
      (item: BookingItem) => item.ticket_type?.event != null,
    ).length;
    return sum + count;
  }, 0);

  // Weekly Stats Calculations
  const weeklyPlacesVisited =
    (weeklyReviews?.length || 0) + (weeklyBookings?.length || 0);
  const weeklyPointsEarned =
    weeklyPoints?.reduce((sum, p) => sum + p.points, 0) || 0;
  const streakDays = streakData?.current_streak || 0;

  const previousWeekPointsEarned =
    previousWeekPoints?.reduce((sum, p) => sum + p.points, 0) || 0;

  // Gamification / Level Logic
  const userPoints = profile?.points ?? 0;

  const currentRank = ranksData?.rank || {
    name: "Unranked",
    color: "from-slate-500 to-slate-600",
    min_xp_required: 0,
  };

  const nextRank = allRanks?.find((r) => r.min_xp_required > userPoints);

  const userLevel = {
    name: currentRank.name,
    minPoints: currentRank.min_xp_required || 0,
    maxPoints: nextRank?.min_xp_required || Infinity,
    color: currentRank.color || "from-slate-500 to-slate-600",
  };

  const nextLevel = nextRank
    ? {
        name: nextRank.name,
        minPoints: nextRank.min_xp_required,
        maxPoints: Infinity,
        color: nextRank.color || "from-blue-500 to-blue-600",
      }
    : undefined;

  const progressPercentage = nextLevel
    ? ((userPoints - userLevel.minPoints) /
        (nextLevel.minPoints - userLevel.minPoints)) *
      100
    : 100;

  // Recent Activity Feed Construction
  const recentActivity: ActivityItem[] = [
    ...(pointsActivity?.map((activity: PointsActivity) => ({
      type: "points" as const,
      content: getFriendlyActivityName(activity.reason || "Earned points"),
      time: new Date(activity.created_at).toLocaleDateString(),
      points: activity.points,
    })) || []),
    ...(userReviews?.map((review: Review) => ({
      type: "review" as const,
      content: `Reviewed ${review.listing?.name || "a place"}`,
      time: new Date(review.created_at).toLocaleDateString(),
      rating: review.rating,
    })) || []),
    ...(userBookings?.map((booking: Booking) => ({
      type: "booking" as const,
      content: `Booked ${
        booking.booking_items?.[0]?.ticket_type?.event?.name || "an event"
      }`,
      time: new Date(booking.created_at).toLocaleDateString(),
      amount: booking.total_amount,
    })) || []),
    ...(userFavoritesActivity?.map((favorite: FavoriteActivity) => ({
      type: "favorite" as const,
      content: `Added ${favorite.listing?.name || "a place"} to favorites`,
      time: new Date(favorite.created_at).toLocaleDateString(),
      location: favorite.listing?.address || undefined,
    })) || []),
    ...(userAchievements?.map((achievement: AchievementActivity) => ({
      type: "achievement" as const,
      content: `Unlocked achievement: ${
        achievement.badge?.name || "New Badge"
      }`,
      time: new Date(achievement.awarded_at).toLocaleDateString(),
    })) || []),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  // --- Retrieve Recommended Listings (Dependent on Favorites) ---
  const favoriteCategories =
    userFavorites?.map((f) => f.listing?.category_id).filter(Boolean) || [];

  let recommendedListings: MinimalListing[] = [];

  if (favoriteCategories.length > 0) {
    const { data } = await supabase
      .from("listings")
      .select(`id, name, slug, address, reviews(rating)`)
      .in("category_id", favoriteCategories)
      .eq("status", "published")
      .limit(4);
    recommendedListings = data || [];
  } else {
    const { data } = await supabase
      .from("listings")
      .select(`id, name, slug, address, reviews(rating)`)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(4);
    recommendedListings = data || [];
  }

  return (
    <div className="space-y-12 md:space-y-8 lg:space-y-12">
      {/* Dashboard hero */}
      <PremiumDashboardHero
        user={{
          id: user.id,
          name: profile?.full_name || user.email?.split("@")[0] || "",
          email: user.email || "",
          avatar: profile?.avatar_url || undefined,
        }}
        profile={{
          full_name: profile?.full_name || undefined,
          avatar_url: profile?.avatar_url || undefined,
          points: profile?.points || 0,
        }}
        level={userLevel}
        nextLevel={nextLevel}
        progressPercentage={progressPercentage}
        weeklyPointsEarned={weeklyPointsEarned}
        previousWeekPointsEarned={previousWeekPointsEarned}
        weeklyStats={{
          placesVisited: weeklyPlacesVisited,
          reviewsWritten: weeklyReviews?.length || 0,
          eventsBooked: eventsBookedTotal || 0,
        }}
      />

      {/* Stats grid */}
      <AdvancedStatsGrid
        stats={{
          reviews: profile?.reviews?.[0]?.count || 0,
          bookings: profile?.bookings?.[0]?.count || 0,
          favorites: profile?.favorites?.[0]?.count || 0,
          achievements: userBadges?.length || 0,
        }}
        trends={{
          reviews: { value: 15, isPositive: true },
          bookings: { value: 8, isPositive: true },
          favorites: { value: 12, isPositive: true },
          achievements: { value: 25, isPositive: true },
        }}
      />

      {/* Invite & Share Section */}
      <InviteShareDashboardSection />

      {/* Quick actions */}
      <PremiumQuickActions />

      {/* Weekly Insights - Only the insights cards */}
      <PremiumInsightsPanel
        weeklyStats={{
          placesVisited: weeklyPlacesVisited,
          pointsEarned: weeklyPointsEarned,
          streakDays: streakDays,
        }}
        recommendations={[]} // Empty to only show weekly insights
        showOnlyWeeklyInsights={true}
      />

      {/* Bottom section - two column layout */}
      <PremiumBottomSection
        recommendations={
          recommendedListings?.map((listing) => ({
            id: listing.id,
            name: listing.name,
            address: listing.address || "Address not available",
            slug: listing.slug,
            rating:
              listing.reviews && listing.reviews.length > 0
                ? listing.reviews.reduce(
                    (sum: number, r: { rating: number }) => sum + r.rating,
                    0,
                  ) / listing.reviews.length
                : undefined,
          })) || []
        }
        activities={recentActivity}
        upcomingEvents={
          upcomingEvents?.map((event) => ({
            id: event.id,
            name: event.name,
            slug: event.slug,
            start_time: event.start_time,
          })) || undefined
        }
      />
    </div>
  );
}
