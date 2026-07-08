"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Trophy,
  Medal,
  Award,
  Search,
  Download,
  Clock,
  TrendingUp,
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

export function LeaderboardView() {
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [period, setPeriod] = React.useState("all_time");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const pageSize = 25;
  const { toast } = useToast();

  // Fetch leaderboard
  const fetchLeaderboard = React.useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setIsLoading(true);
        const offset = (currentPage - 1) * pageSize;
        const response = await fetch(
          `/api/gamification/leaderboard?period=${period}&limit=${pageSize}&offset=${offset}`
        );
        const data = await response.json();

        if (response.ok) {
          setLeaderboard(data.leaderboard || []);
          setTotalCount(data.total_count || 0);
          setLastRefresh(new Date());
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to fetch leaderboard",
            variant: "destructive",
          });
        }
      } catch (_error) {
        toast({
          title: "Error",
          description: "Failed to load leaderboard",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [period, currentPage, pageSize, toast]
  );

  React.useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLeaderboard(false);
    toast({
      title: "Refreshed",
      description: "Leaderboard has been updated",
    });
  };

  // Export to CSV
  const handleExport = () => {
    const csv = [
      ["Rank", "Username", "XP Total", "Rank Name"].join(","),
      ...leaderboard.map((entry) =>
        [
          entry.rank_position,
          entry.username || "Anonymous",
          entry.xp_total,
          entry.rank_name,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard_${period}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: `Leaderboard exported to CSV`,
    });
  };

  // Filter by search
  const filteredLeaderboard = React.useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;

    const query = searchQuery.toLowerCase();
    return leaderboard.filter((entry) =>
      entry.username?.toLowerCase().includes(query)
    );
  }, [leaderboard, searchQuery]);

  // Get rank icon
  const getRankIcon = (position: number) => {
    if (position === 1) return <Trophy className="h-6 w-6 text-amber-500" />;
    if (position === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (position === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <Award className="h-5 w-5 text-muted-foreground" />;
  };

  // Get rank badge color
  const getRankColor = (rankName: string) => {
    const colors: { [key: string]: string } = {
      INSIDER:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      Influencer:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      Navigator:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      Contributor:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      Explorer: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    };
    return colors[rankName] || colors.Explorer;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading leaderboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Tabs */}
      <Tabs value={period} onValueChange={setPeriod} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          {periodOptions.map((option) => {
            const Icon = option.icon;
            return (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Last Refresh Time */}
      {lastRefresh && (
        <p className="text-sm text-muted-foreground text-center">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* Leaderboard */}
      <Card>
        <CardContent className="p-0">
          {filteredLeaderboard.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {searchQuery ? "No users found" : "No leaderboard data yet"}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLeaderboard.map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-12 h-12">
                      {entry.rank_position <= 3 ? (
                        getRankIcon(entry.rank_position)
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">
                          #{entry.rank_position}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={entry.avatar_url || undefined}
                        alt={entry.username || "User"}
                      />
                      <AvatarFallback>
                        {(entry.username || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">
                          {entry.username || "Anonymous User"}
                        </p>
                        <span
                          className={`px-2 py-1 text-xs rounded-full font-medium ${getRankColor(
                            entry.rank_name
                          )}`}
                        >
                          {entry.rank_name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {entry.xp_total.toLocaleString()} XP
                      </p>
                    </div>

                    {/* XP Bar (Visual) */}
                    <div className="hidden lg:block w-32">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              (entry.xp_total /
                                (filteredLeaderboard[0]?.xp_total || 1)) *
                                100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* XP Display */}
                    <div className="text-right hidden sm:block">
                      <p className="text-2xl font-bold text-primary">
                        {entry.xp_total.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {Math.ceil(totalCount / pageSize)}
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setCurrentPage((p) =>
                Math.min(Math.ceil(totalCount / pageSize), p + 1)
              )
            }
            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
