"use client";

import { motion } from "framer-motion";
import HeroSection from "@/components/ui/HeroSection";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Sparkles, Users, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardStats {
  activeRankers: number;
  totalXpAwarded: number;
  topRankXp: number;
}

interface LeaderboardHeroProps {
  stats?: LeaderboardStats;
}

export function LeaderboardHero({ stats }: LeaderboardHeroProps) {
  // Default stats if not provided
  const displayStats = stats || {
    activeRankers: 0,
    totalXpAwarded: 0,
    topRankXp: 0,
  };

  const statCards = [
    {
      icon: Users,
      label: "Active Members",
      value:
        displayStats.activeRankers > 0
          ? `${displayStats.activeRankers}+`
          : "Loading",
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      icon: Zap,
      label: "Total XP Awarded",
      value:
        displayStats.totalXpAwarded > 0
          ? displayStats.totalXpAwarded >= 1000
            ? `${Math.round(displayStats.totalXpAwarded / 1000)}K+`
            : `${displayStats.totalXpAwarded}`
          : "Loading",
      colors: {
        bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
        border: "border-amber-500/30",
        icon: "text-amber-500",
        accent: "bg-amber-500",
        glow: "hover:shadow-xl hover:shadow-amber-500/25",
      },
    },
    {
      icon: TrendingUp,
      label: "Top Ranker XP",
      value:
        displayStats.topRankXp > 0
          ? displayStats.topRankXp >= 1000
            ? `${Math.round(displayStats.topRankXp / 1000)}K`
            : `${displayStats.topRankXp}`
          : "Loading",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
  ];

  return (
    <HeroSection
      floating={
        <>
          <motion.div
            animate={{ y: [0, -18, 0], rotate: [0, 6, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-16 sm:top-20 left-4 sm:left-20 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
          >
            <Trophy className="h-4 w-4 sm:h-6 sm:w-6 text-amber-400" />
          </motion.div>

          <motion.div
            animate={{ y: [0, 14, 0], rotate: [0, -6, 0] }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.5,
            }}
            className="absolute top-24 sm:top-32 right-4 sm:right-32 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
          >
            <Medal className="h-4 w-4 sm:h-6 sm:w-6 text-gray-400" />
          </motion.div>
        </>
      }
    >
      <div className="container mx-auto px-6 lg:px-8 text-center space-y-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Sparkles className="w-4 h-4 mr-2" />
            Community Rankings
          </Badge>
        </motion.div>

        {/* Main Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="space-y-4 max-w-4xl mx-auto"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
            Discover Top <span className="gradient-text-primary">Members</span>
            <br />
            by XP
          </h1>

          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
            See who&apos;s leading the Inside Karachi community by XP. Review
            places, attend events, and climb the leaderboard rankings.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto pt-8"
        >
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{
                  scale: 1.02,
                  y: -4,
                  transition: { duration: 0.2, ease: "easeOut" },
                }}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.6 }}
                className="group"
              >
                <div
                  className={cn(
                    "relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 group cursor-pointer",
                    "backdrop-blur-xl border transition-all duration-500",
                    `bg-gradient-to-br ${stat.colors.bg}`,
                    stat.colors.border,
                    stat.colors.glow,
                    "transform-gpu",
                  )}
                >
                  {/* Border glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div
                      className={cn(
                        "absolute inset-0 rounded-2xl opacity-30 blur-md",
                        stat.colors.accent,
                      )}
                    />
                    <div
                      className={cn(
                        "absolute inset-0 rounded-2xl opacity-10 blur-lg",
                        stat.colors.accent,
                      )}
                    />
                  </div>

                  {/* Animated accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `linear-gradient(90deg, transparent, var(--color), transparent)`,
                    }}
                  />

                  {/* Content */}
                  <div className="relative space-y-2">
                    <Icon className={cn("h-8 w-8 mx-auto", stat.colors.icon)} />
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </HeroSection>
  );
}
