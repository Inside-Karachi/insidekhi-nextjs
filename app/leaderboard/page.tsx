import { PublicLeaderboard } from "@/components/gamification/PublicLeaderboard";

export const dynamic = "force-dynamic";
import { LeaderboardHero } from "@/components/gamification/LeaderboardHero";
import { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "XP Leaderboard | Inside Karachi",
  description:
    "View the top ranked members of the Inside Karachi community by experience points (XP). Join the competition and climb the ranks!",
};

async function getLeaderboardStats() {
  try {
    const supabase = await createServerSupabase({ publicAnon: true });

    // Get count of active users with XP using count query
    const { count: activeUsersCount } = await supabase
      .from("leaderboard_cache")
      .select("*", { count: "exact", head: true })
      .eq("period_type", "all_time");

    // Get total XP awarded across all users
    const { data: totalXpData } = await supabase
      .from("leaderboard_cache")
      .select("xp_total")
      .eq("period_type", "all_time");

    // Calculate total XP awarded
    const totalXpAwarded =
      totalXpData?.reduce((sum: number, row) => sum + (row.xp_total || 0), 0) ||
      0;

    // Get top ranker XP
    const { data: topRankerData } = await supabase
      .from("leaderboard_cache")
      .select("xp_total")
      .eq("period_type", "all_time")
      .order("rank_position", { ascending: true })
      .limit(1);

    const stats = {
      activeRankers: activeUsersCount || 0,
      totalXpAwarded: totalXpAwarded,
      topRankXp: topRankerData?.[0]?.xp_total || 0,
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
