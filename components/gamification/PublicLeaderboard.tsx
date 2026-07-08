"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trophy,
  Medal,
  Award,
  Clock,
  TrendingUp,
  Search,
  RefreshCw,
  Zap,
} from "lucide-react";

interface LeaderboardEntry {
  rank_position: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  xp_total: number;
  rank_name: string;
}

const periodOptions = [
  { value: "all_time", label: "All Time", icon: Trophy },
  { value: "monthly", label: "This Month", icon: TrendingUp },
  { value: "weekly", label: "This Week", icon: Clock },
];

export function PublicLeaderboard() {
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [period, setPeriod] = React.useState("all_time");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const pageSize = 25;

  // Fetch leaderboard
  const fetchLeaderboard = React.useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setIsLoading(true);
        const offset = (currentPage - 1) * pageSize;
        const response = await fetch(
          `/api/gamification/leaderboard?period=${period}&limit=${pageSize}&offset=${offset}`,
        );
        const data = await response.json();

        if (response.ok) {
          setLeaderboard(data.leaderboard || []);
          setTotalCount(data.total_count || 0);
        }
      } catch (_error) {
        console.error("Failed to load leaderboard");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [period, currentPage, pageSize],
  );

  React.useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Reset to page 1 when period changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [period]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLeaderboard(false);
  };

  // Filter by search
  const filteredLeaderboard = React.useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;

    const query = searchQuery.toLowerCase();
    return leaderboard.filter((entry) =>
      entry.username?.toLowerCase().includes(query),
    );
  }, [leaderboard, searchQuery]);

  // Get rank icon
  const getRankIcon = (position: number) => {
    if (position === 1)
      return (
        <div className="relative">
          <Trophy className="h-8 w-8 text-amber-500" />
          <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl" />
        </div>
      );
    if (position === 2)
      return (
        <div className="relative">
          <Medal className="h-7 w-7 text-gray-400" />
          <div className="absolute inset-0 bg-gray-400/20 rounded-full blur-lg" />
        </div>
      );
    if (position === 3)
      return (
        <div className="relative">
          <Medal className="h-7 w-7 text-amber-700" />
          <div className="absolute inset-0 bg-amber-700/20 rounded-full blur-lg" />
        </div>
      );
    return null;
  };

  // Get rank badge color (Reddit-style text badges)
  const getRankBadge = (rankName: string) => {
    const badges: { [key: string]: { color: string; icon: React.ReactNode } } =
      {
        INSIDER: {
          color:
            "bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold",
          icon: <Zap className="h-3 w-3" />,
        },
        Influencer: {
          color:
            "bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold",
          icon: <Trophy className="h-3 w-3" />,
        },
        Navigator: {
          color:
            "bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold",
          icon: <Award className="h-3 w-3" />,
        },
        Contributor: {
          color:
            "bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium",
          icon: <TrendingUp className="h-3 w-3" />,
        },
        Explorer: {
          color: "bg-gray-500/20 text-gray-700 dark:text-gray-300 font-medium",
          icon: null,
        },
      };
    return badges[rankName] || badges.Explorer;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading leaderboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Period Tabs - Centered */}
      <Tabs value={period} onValueChange={setPeriod} className="w-full mb-8">
        <div className="flex justify-center">
          <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-2 border border-primary/10 inline-flex">
            <TabsList className="grid grid-cols-3 h-auto bg-transparent gap-1">
              {periodOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:text-muted-foreground px-6 py-3 rounded-lg transition-all duration-200 font-medium"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="hidden sm:inline">{option.label}</span>
                    <span className="sm:hidden">
                      {option.label.split(" ")[0]}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>
      </Tabs>

      {/* Search & Refresh */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 text-base"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-12 px-6"
        >
          <RefreshCw
            className={`h-5 w-5 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Leaderboard */}
      <Card className="overflow-hidden border-2 shadow-xl">
        <CardContent className="p-0">
          {filteredLeaderboard.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <Trophy className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-xl">
                {searchQuery ? "No users found" : "No leaderboard data yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLeaderboard.map((entry, index) => {
                const rankBadge = getRankBadge(entry.rank_name);
                const isTopThree = entry.rank_position <= 3;

                return (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`p-6 hover:bg-primary/5 transition-all duration-200 ${
                      isTopThree ? "bg-primary/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-6">
                      {/* Rank */}
                      <div className="flex items-center justify-center w-16 h-16">
                        {getRankIcon(entry.rank_position) || (
                          <span className="text-2xl font-bold text-muted-foreground">
                            #{entry.rank_position}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-16 w-16 border-4 border-background shadow-lg">
                        <AvatarImage
                          src={entry.avatar_url || undefined}
                          alt={entry.username || "User"}
                        />
                        <AvatarFallback className="text-lg font-bold">
                          {(entry.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-xl font-bold truncate">
                            {entry.username || "Anonymous User"}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full shadow-sm ${rankBadge.color}`}
                          >
                            {rankBadge.icon}
                            {entry.rank_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Zap className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {entry.xp_total.toLocaleString()} XP
                          </span>
                        </div>
                      </div>

                      {/* XP Bar (Desktop) */}
                      <div className="hidden lg:block w-48">
                        <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 transition-all duration-700 shadow-lg"
                            style={{
                              width: `${Math.min(
                                (entry.xp_total /
                                  (filteredLeaderboard[0]?.xp_total || 1)) *
                                  100,
                                100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* XP Display (Desktop) */}
                      <div className="hidden xl:block text-right min-w-[100px]">
                        <p className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                          {entry.xp_total.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium">
                          EXPERIENCE
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > pageSize && !searchQuery && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-11 px-6"
          >
            Previous
          </Button>
          <span className="text-base font-medium text-muted-foreground px-4">
            Page {currentPage} of {Math.ceil(totalCount / pageSize)}
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setCurrentPage((p) =>
                Math.min(Math.ceil(totalCount / pageSize), p + 1),
              )
            }
            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
            className="h-11 px-6"
          >
            Next
          </Button>
        </div>
      )}

      {/* Bottom Info */}
      <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">How to Earn XP</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  Write reviews for restaurants and places
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  Attend events and check-in with QR codes
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  Log in daily to build your streak
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  Complete weekly challenges
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
