"use client";

import { useState, useEffect } from "react";
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
        const response = await fetch("/api/user/gamification");
        if (!response.ok) {
          throw new Error("Failed to fetch gamification details");
        }
        const resData = await response.json();

        setData({
          leaderboardEntry: null,
          xpTotal: resData.xpTotal,
          rank: resData.rank,
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
