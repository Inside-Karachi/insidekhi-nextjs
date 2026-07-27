import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Role-aware sidebar counters. admin/super_admin -> platform totals;
// lister -> global content counts; organizer -> own events/bookings/tickets;
// everyone else -> own reviews/bookings/favorites.
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { rows: profileRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [user.id],
  );
  const role = profileRows[0]?.role ?? null;

  if (role === "admin" || role === "super_admin") {
    const [usersResult, eventsResult, listingsResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM profiles`),
      query(`SELECT COUNT(*) FROM events`),
      query(`SELECT COUNT(*) FROM listings`),
    ]);
    return ok({
      role,
      stats: {
        users: parseInt(usersResult.rows[0].count, 10) || 0,
        events: parseInt(eventsResult.rows[0].count, 10) || 0,
        listings: parseInt(listingsResult.rows[0].count, 10) || 0,
      },
    });
  }

  if (role === "lister") {
    const [listingsResult, eventsResult, reviewsResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM listings`),
      query(`SELECT COUNT(*) FROM events`),
      query(`SELECT COUNT(*) FROM reviews`),
    ]);
    return ok({
      role,
      stats: {
        listings: parseInt(listingsResult.rows[0].count, 10) || 0,
        events: parseInt(eventsResult.rows[0].count, 10) || 0,
        reviews: parseInt(reviewsResult.rows[0].count, 10) || 0,
      },
    });
  }

  if (role === "organizer") {
    const [eventsResult, bookingsResult, ticketsResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM events WHERE organizer_id = $1`, [user.id]),
      query(`SELECT COUNT(*) FROM bookings WHERE user_id = $1`, [user.id]),
      query(
        `SELECT COUNT(*) FROM ticket_passes tp
         JOIN bookings b ON b.id = tp.booking_id
         WHERE b.user_id = $1`,
        [user.id],
      ),
    ]);
    return ok({
      role,
      stats: {
        events: parseInt(eventsResult.rows[0].count, 10) || 0,
        bookings: parseInt(bookingsResult.rows[0].count, 10) || 0,
        tickets: parseInt(ticketsResult.rows[0].count, 10) || 0,
      },
    });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    reviewsResult,
    bookingsResult,
    favoritesResult,
    weeklyXpResult,
    weeklyBookingsResult,
    weeklyReviewsResult,
  ] = await Promise.all([
    query(`SELECT COUNT(*) FROM reviews WHERE user_id = $1`, [user.id]),
    query(`SELECT COUNT(*) FROM bookings WHERE user_id = $1`, [user.id]),
    query(`SELECT COUNT(*) FROM favorite_listings WHERE user_id = $1`, [
      user.id,
    ]),
    query(
      `SELECT COALESCE(SUM(points), 0) AS total FROM points_log WHERE user_id = $1 AND created_at >= $2`,
      [user.id, sevenDaysAgo],
    ),
    query(
      `SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND payment_status = 'paid' AND created_at >= $2`,
      [user.id, sevenDaysAgo],
    ),
    query(
      `SELECT COUNT(*) FROM reviews WHERE user_id = $1 AND created_at >= $2`,
      [user.id, sevenDaysAgo],
    ),
  ]);
  return ok({
    role: role ?? "user",
    stats: {
      reviews: parseInt(reviewsResult.rows[0].count, 10) || 0,
      bookings: parseInt(bookingsResult.rows[0].count, 10) || 0,
      favorites: parseInt(favoritesResult.rows[0].count, 10) || 0,
    },
    weekly: {
      xp_earned: parseInt(weeklyXpResult.rows[0].total, 10) || 0,
      events_attended: parseInt(weeklyBookingsResult.rows[0].count, 10) || 0,
      reviews_written: parseInt(weeklyReviewsResult.rows[0].count, 10) || 0,
    },
  });
});
