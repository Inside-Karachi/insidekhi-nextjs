import type { ComponentProps } from "react";
import { getFriendlyActivityName } from "@/lib/gamification";

import { redirect } from "next/navigation";
import { PremiumDashboardHero } from "@/components/dashboard/PremiumDashboardHero";
import { AdvancedStatsGrid } from "@/components/dashboard/AdvancedStatsGrid";
import { PremiumInsightsPanel } from "@/components/dashboard/PremiumInsightsPanel";
import { PremiumQuickActions } from "@/components/dashboard/PremiumQuickActions";
import { PremiumBottomSection } from "@/components/dashboard/PremiumBottomSection";
import { InviteShareDashboardSection } from "@/components/dashboard/InviteShareDashboardSection";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import type { SavedLocation } from "@/components/dashboard/LocationSwitcher";
import { getSessionFromCookies } from "@/lib/auth/session";
import { query } from "@/lib/db";

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

interface NearbyListingRow {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  category_id: number;
  category_name: string | null;
  avg_rating: number | null;
  distance_meters: number | null;
  status: string;
}

interface RecommendedListing {
  id: number;
  name: string;
  slug: string;
  address: string;
  rating?: number;
  category?: string;
  distanceKm?: number;
  reason?: string;
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
  const sessionUser = await getSessionFromCookies();

  if (!sessionUser) {
    redirect("/login");
  }

  // Construct mock user object matching original Supabase structure
  const user = {
    id: sessionUser.userId,
    email: sessionUser.email,
  };

  // Parallel fetch: Profile and initial required data
  const profileQuery = query(
    `SELECT p.*,
       (SELECT COUNT(*) FROM reviews WHERE user_id = $1) AS reviews_count,
       (SELECT COUNT(*) FROM bookings WHERE user_id = $1) AS bookings_count,
       (SELECT COUNT(*) FROM favorite_listings WHERE user_id = $1) AS favorites_count
     FROM public.profiles p
     WHERE p.id = $1
     LIMIT 1`,
    [user.id]
  );

  const ranksQuery = query(
    `SELECT r.id, r.name, r.slug, r.color, r.min_xp_required
     FROM user_ranks ur
     LEFT JOIN ranks r ON ur.rank_id = r.id
     WHERE ur.user_id = $1 AND ur.current_rank = true
     LIMIT 1`,
    [user.id]
  );

  const [profileRes, ranksRes] = await Promise.all([profileQuery, ranksQuery]);
  const rawProfile = profileRes.rows[0];
  const rank = ranksRes.rows[0];

  if (!rawProfile) {
    console.error("Failed to load profile for dashboard: user profile not found");
    redirect("/login");
  }

  // Map database object back to Supabase client shape expected by components
  const profile = {
    ...rawProfile,
    reviews: [{ count: Number(rawProfile.reviews_count || 0) }],
    bookings: [{ count: Number(rawProfile.bookings_count || 0) }],
    favorites: [{ count: Number(rawProfile.favorites_count || 0) }],
  };

  const ranksData = rank ? { rank } : null;

  // Use active_role to determine which dashboard to show - staff switched to
  // public_user will see the public dashboard below, not the admin ones.
  const activeRole = profile?.active_role || profile?.role;

  if (activeRole === "super_admin") {
    const { SuperAdminDashboardWrapper } = await import(
      "@/components/dashboard/SuperAdminDashboardWrapper"
    );
    return (
      <SuperAdminDashboardWrapper
        user={user}
        profile={
          profile as unknown as ComponentProps<
            typeof SuperAdminDashboardWrapper
          >["profile"]
        }
      />
    );
  }

  if (activeRole === "admin") {
    const { AdminDashboard } = await import(
      "@/components/dashboard/AdminDashboard"
    );
    return (
      <AdminDashboard
        user={user}
        profile={
          profile as unknown as ComponentProps<
            typeof AdminDashboard
          >["profile"]
        }
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

  // Parallel fetch: All user dashboard data
  const [
    pointsActivityRes,
    userReviewsRes,
    userFavoritesActivityRes,
    userAchievementsRes,
    userBookingsRes,
    weeklyReviewsRes,
    weeklyBookingsRes,
    weeklyPointsRes,
    userBadgesRes,
    userFavoritesRes,
    upcomingEventsRes,
    allRanksRes,
    streakDataRes,
    previousWeekPointsRes,
    savedLocationsRes,
  ] = await Promise.all([
    // 1. Points Log
    query(
      `SELECT * FROM points_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [user.id]
    ),
    // 2. Reviews
    query(
      `SELECT r.id, r.rating, r.comment, r.created_at, 
              json_build_object('name', l.name, 'slug', l.slug) AS listing
       FROM reviews r
       LEFT JOIN listings l ON r.listing_id = l.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 3`,
      [user.id]
    ),
    // 3. Favorites Activity
    query(
      `SELECT fl.user_id, fl.listing_id, fl.created_at,
              json_build_object('name', l.name, 'slug', l.slug, 'address', l.address) AS listing
       FROM favorite_listings fl
       LEFT JOIN listings l ON fl.listing_id = l.id
       WHERE fl.user_id = $1
       ORDER BY fl.created_at DESC
       LIMIT 3`,
      [user.id]
    ),
    // 4. Achievements Activity
    query(
      `SELECT ub.user_id, ub.badge_id, ub.awarded_at,
              json_build_object('name', b.name, 'description', b.description, 'icon_url', b.icon_url) AS badge
       FROM user_badges ub
       LEFT JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.awarded_at DESC
       LIMIT 3`,
      [user.id]
    ),
    // 5. Bookings
    query(
      `SELECT b.id, b.total_amount, b.status, b.created_at,
             (
               SELECT json_agg(
                 json_build_object(
                   'quantity', bi.quantity,
                   'ticket_type', json_build_object(
                     'name', tt.name,
                     'event', json_build_object(
                       'name', e.name,
                       'slug', e.slug,
                       'start_time', e.start_time
                     )
                   )
                 )
               )
               FROM booking_items bi
               LEFT JOIN ticket_types tt ON bi.ticket_type_id = tt.id
               LEFT JOIN events e ON tt.event_id = e.id
               WHERE bi.booking_id = b.id
             ) AS booking_items
      FROM bookings b
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT 3`,
      [user.id]
    ),
    // 6. Weekly Reviews
    query(
      `SELECT id FROM reviews WHERE user_id = $1 AND created_at >= $2`,
      [user.id, sevenDaysAgo.toISOString()]
    ),
    // 7. Weekly Bookings
    query(
      `SELECT id FROM bookings WHERE user_id = $1 AND created_at >= $2`,
      [user.id, sevenDaysAgo.toISOString()]
    ),
    // 8. Weekly Points
    query(
      `SELECT points FROM points_log WHERE user_id = $1 AND created_at >= $2`,
      [user.id, sevenDaysAgo.toISOString()]
    ),
    // 9. User Badges (Full List)
    query(
      `SELECT json_build_object('id', badge_id) AS badge FROM user_badges WHERE user_id = $1`,
      [user.id]
    ),
    // 10. User Favorites (For Recommendations)
    query(
      `SELECT json_build_object('category_id', l.category_id) AS listing
       FROM favorite_listings fl
       LEFT JOIN listings l ON fl.listing_id = l.id
       WHERE fl.user_id = $1
       LIMIT 5`,
      [user.id]
    ),
    // 11. Upcoming Events (General)
    query(
      `SELECT id, name, slug, start_time
       FROM events
       WHERE status = 'published' AND start_time >= $1
       ORDER BY start_time ASC
       LIMIT 2`,
      [new Date().toISOString()]
    ),
    // 12. All Ranks
    query(
      `SELECT id, name, slug, color, min_xp_required FROM ranks WHERE is_active = true ORDER BY min_xp_required ASC`
    ),
    // 13. Streak Data
    query(
      `SELECT current_streak FROM daily_login_streaks WHERE user_id = $1 LIMIT 1`,
      [user.id]
    ),
    // 14. Previous Week Points
    query(
      `SELECT points FROM points_log WHERE user_id = $1 AND created_at >= $2 AND created_at < $3`,
      [user.id, previousWeekStart.toISOString(), previousWeekEnd.toISOString()]
    ),
    // 15. Saved Locations (table may not exist yet if the migration hasn't run)
    query(
      `SELECT id, label, custom_label, address, latitude, longitude, is_active, created_at
       FROM public.user_saved_locations
       WHERE user_id = $1
       ORDER BY is_active DESC, created_at ASC`,
      [user.id],
    ).catch((e) => {
      console.error("Failed to load saved locations:", e);
      return { rows: [] as SavedLocation[] };
    }),
  ]);

  // Extract Data from Responses
  const pointsActivity = pointsActivityRes.rows;
  const userReviews = userReviewsRes.rows;
  const userFavoritesActivity = userFavoritesActivityRes.rows;
  const userAchievements = userAchievementsRes.rows;
  const userBookings = userBookingsRes.rows;
  const weeklyReviews = weeklyReviewsRes.rows;
  const weeklyBookings = weeklyBookingsRes.rows;
  const weeklyPoints = weeklyPointsRes.rows;
  const userBadges = userBadgesRes.rows;
  const userFavorites = userFavoritesRes.rows;
  const upcomingEvents = upcomingEventsRes.rows;
  const allRanks = allRanksRes.rows;
  const streakData = streakDataRes.rows[0];
  const previousWeekPoints = previousWeekPointsRes.rows;
  const savedLocations: SavedLocation[] = savedLocationsRes.rows;
  const activeLocation = savedLocations.find((l) => l.is_active) || null;

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

  // --- Retrieve Recommended Listings (Favorites + Active Location) ---
  const favoriteCategories: number[] =
    userFavorites?.map((f) => f.listing?.category_id).filter(Boolean) || [];

  let recommendedListings: RecommendedListing[] = [];

  if (activeLocation) {
    // Location-aware: pull nearby published listings ranked by distance,
    // then bubble favorite-category matches to the top.
    try {
      const { rows: nearby } = await query(
        `SELECT * FROM get_nearby_listings($1, $2, $3, $4)`,
        [activeLocation.latitude, activeLocation.longitude, 10000, 16],
      );

      const published = (nearby as NearbyListingRow[]).filter(
        (l) => l.status === "published",
      );
      const matched = published.filter((l) =>
        favoriteCategories.includes(l.category_id),
      );
      const rest = published.filter(
        (l) => !favoriteCategories.includes(l.category_id),
      );

      recommendedListings = [...matched, ...rest].slice(0, 6).map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        address: l.address || "Address not available",
        rating: l.avg_rating ?? undefined,
        category: l.category_name ?? undefined,
        distanceKm: l.distance_meters != null ? l.distance_meters / 1000 : undefined,
        reason: favoriteCategories.includes(l.category_id)
          ? `Because you like ${l.category_name || "similar places"}`
          : "Popular near your location",
      }));
    } catch (e) {
      console.error("Error fetching location-based recommendations:", e);
    }
  }

  // Fallback (no active location, or the query above returned nothing)
  if (recommendedListings.length === 0) {
    try {
      const res = favoriteCategories.length > 0
        ? await query(
            `SELECT l.id, l.name, l.slug, l.address, c.name AS category_name,
                    (SELECT json_agg(json_build_object('rating', r.rating)) FROM reviews r WHERE r.listing_id = l.id) AS reviews
             FROM listings l
             LEFT JOIN categories c ON l.category_id = c.id
             WHERE l.category_id = ANY($1) AND l.status = 'published'
             LIMIT 6`,
            [favoriteCategories]
          )
        : await query(
            `SELECT l.id, l.name, l.slug, l.address, c.name AS category_name,
                    (SELECT json_agg(json_build_object('rating', r.rating)) FROM reviews r WHERE r.listing_id = l.id) AS reviews
             FROM listings l
             LEFT JOIN categories c ON l.category_id = c.id
             WHERE l.status = 'published'
             ORDER BY l.created_at DESC
             LIMIT 6`
          );

      recommendedListings = res.rows.map((listing) => ({
        id: listing.id,
        name: listing.name,
        slug: listing.slug,
        address: listing.address || "Address not available",
        category: listing.category_name ?? undefined,
        reason:
          favoriteCategories.length > 0
            ? `Because you like ${listing.category_name || "similar places"}`
            : "New on Inside Karachi",
        rating:
          listing.reviews && listing.reviews.length > 0
            ? listing.reviews.reduce(
                (sum: number, r: { rating: number }) => sum + r.rating,
                0,
              ) / listing.reviews.length
            : undefined,
      }));
    } catch (e) {
      console.error("Error fetching recommended listings:", e);
    }
  }

  return (
    <div className="space-y-12 md:space-y-8 lg:space-y-12">
      {/* Dashboard tab strip */}
      <DashboardTabs />

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
        savedLocations={savedLocations}
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
        recommendations={recommendedListings}
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
