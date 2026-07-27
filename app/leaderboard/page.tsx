import { PublicLeaderboard } from "@/components/gamification/PublicLeaderboard";

export const dynamic = "force-dynamic";
import { LeaderboardHero } from "@/components/gamification/LeaderboardHero";
import { Metadata } from "next";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "XP Leaderboard | Inside Karachi",
  description:
    "View the top ranked members of the Inside Karachi community by experience points (XP). Join the competition and climb the ranks!",
};

async function getLeaderboardStats() {
  try {
    // Get count of active users with XP
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM public.leaderboard_cache WHERE period_type = 'all_time'`,
    );
    const activeUsersCount = Number(countRows[0]?.count ?? 0);

    // Get total XP awarded across all users
    const { rows: totalXpRows } = await query(
      `SELECT xp_total FROM public.leaderboard_cache WHERE period_type = 'all_time'`,
    );

    // Calculate total XP awarded
    const totalXpAwarded = totalXpRows.reduce(
      (sum: number, row) => sum + (row.xp_total || 0),
      0
    );

    // Get top ranker XP
    const { rows: topRankerRows } = await query(
      `SELECT xp_total
       FROM public.leaderboard_cache
       WHERE period_type = 'all_time'
       ORDER BY rank_position ASC
       LIMIT 1`,
    );

    const stats = {
      activeRankers: activeUsersCount || 0,
      totalXpAwarded: totalXpAwarded,
      topRankXp: topRankerRows?.[0]?.xp_total || 0,
    };

    return stats;
  } catch (error) {
    console.error("Error fetching leaderboard stats:", error);
    return {
      activeRankers: 0,
      totalXpAwarded: 0,
      topRankXp: 0,
    };
  }
}

export default async function LeaderboardPage() {
  const stats = await getLeaderboardStats();

  return (
    <div className="min-h-screen">
      <LeaderboardHero stats={stats} />

      {/* Leaderboard Content - Added top margin for spacing */}
      <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl">
        <PublicLeaderboard />
      </div>
    </div>
  );
}
