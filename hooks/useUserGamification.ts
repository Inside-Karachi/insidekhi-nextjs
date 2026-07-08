"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaderboardCacheEntry } from "@/types/gamification.types";

interface UserGamificationData {
  leaderboardEntry: LeaderboardCacheEntry | null;
  xpTotal: number;
  rank: string;
  rankPosition: number;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch user's gamification data (rank and XP)
 * Fetches from leaderboard_cache for all-time standings
 * Requires authenticated user
 */
export function useUserGamification(userId: string | undefined) {
  const [data, setData] = useState<UserGamificationData>({
    leaderboardEntry: null,
    xpTotal: 0,
    rank: "Unranked",
    rankPosition: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!userId) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: "No user ID provided",
      }));
      return;
    }

    const fetchGamificationData = async () => {
      try {
        const supabase = createClient();

        // Fetch XP directly from profiles for real-time accuracy
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", userId)
          .single();

        if (profileError) {
          throw new Error(
            `Failed to fetch user profile: ${profileError.message}`
          );
        }

        const xpTotal = profileData?.points || 0;

        // Get user's current rank from user_ranks
        const { data: userRankData, error: rankError } = await supabase
          .from("user_ranks")
          .select(
            `
            id,
            rank:ranks(
              name
            )
          `
          )
          .eq("user_id", userId)
          .eq("current_rank", true)
          .maybeSingle();

        let rankName = "Unranked";
        if (userRankData?.rank) {
          rankName = (userRankData.rank as { name: string }).name;
        } else if (!rankError || rankError.code === "PGRST116") {
          // PGRST116 = no rows found, user is unranked
          rankName = "Unranked";
        } else if (rankError) {
          console.warn("Error fetching user rank:", rankError);
        }

        setData({
          leaderboardEntry: null,
          xpTotal,
          rank: rankName,
          rankPosition: 0,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error fetching gamification data:", error);
        setData((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch gamification data",
        }));
      }
    };

    fetchGamificationData();
  }, [userId]);

  return data;
}
