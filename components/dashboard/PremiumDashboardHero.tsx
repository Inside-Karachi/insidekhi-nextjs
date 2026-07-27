"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatar } from "@/hooks/useAvatar";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Trophy, Zap, Star, Calendar, MapPin } from "lucide-react";
import { DailyLoginButton } from "@/components/dashboard/DailyLoginButton";
import { WeeklyChallenges } from "@/components/dashboard/WeeklyChallenges";
import {
  LocationSwitcher,
  type SavedLocation,
} from "@/components/dashboard/LocationSwitcher";

interface PremiumDashboardHeroProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  profile: {
    full_name?: string;
    avatar_url?: string;
    points: number;
  };
  level: {
    name: string;
    color: string;
  };
  nextLevel?: {
    name: string;
    minPoints: number;
  };
  progressPercentage: number;
  weeklyPointsEarned: number;
  previousWeekPointsEarned?: number;
  weeklyStats: {
    placesVisited: number;
    reviewsWritten: number;
    eventsBooked: number;
  };
  savedLocations?: SavedLocation[];
  className?: string;
}

export function PremiumDashboardHero({
  user,
  profile,
  level,
  nextLevel,
  progressPercentage,
  weeklyPointsEarned,
  previousWeekPointsEarned = 0,
  weeklyStats,
  savedLocations = [],
  className,
}: PremiumDashboardHeroProps) {
  // Use the avatar URL with fallback
  const { avatarUrl } = useAvatar(user.id, profile?.avatar_url || user.avatar);

  // Calculate week-over-week percentage change
  const weekOverWeekPercentage =
    previousWeekPointsEarned > 0
      ? Math.round(
          ((weeklyPointsEarned - previousWeekPointsEarned) /
            previousWeekPointsEarned) *
            100,
        )
      : weeklyPointsEarned > 0
        ? 100
        : 0;

  const isPositiveChange = weekOverWeekPercentage >= 0;

  const firstName = user.name.split(" ")[0] || "User";

  return (
    <div className={cn("space-y-8", className)}>
      {/* Hero Section - Bold Brand Color Design */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        className="relative overflow-hidden rounded-3xl"
      >
        {/* Bold Brand Background - Primary Color Dominance */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />

        {/* Overlay pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(-45deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />

        {/* Geometric elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10 p-6 md:p-8 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Left Column - Bold Welcome (8 columns) */}
            <div className="lg:col-span-8 space-y-6 lg:space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-4 md:space-y-6"
              >
                {/* Location Switcher - Top Left, above Welcome back */}
                <div className="flex justify-center md:justify-start">
                  <LocationSwitcher initialLocations={savedLocations} />
                </div>

                {/* Bold Typography - Reference Design Style */}
                <div className="space-y-3 md:space-y-4">
                  <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left space-y-2 md:space-y-0 md:space-x-4">
                    <Avatar
                      key={avatarUrl}
                      className="h-12 w-12 md:h-16 md:w-16 ring-2 md:ring-4 ring-white/30 shadow-xl"
                    >
                      <AvatarImage
                        src={avatarUrl || ""}
                        alt={`${firstName}'s profile picture`}
                        onError={(e) => {
                          console.error(
                            "Dashboard Avatar: Image failed to load",
                            {
                              avatarUrl: avatarUrl ? "present" : "null",
                              urlLength: avatarUrl?.length || 0,
                              hasToken: avatarUrl?.includes("token=") || false,
                            },
                          );
                          // Hide broken image and show fallback
                          e.currentTarget.style.display = "none";
                          // Optionally trigger a refresh of the avatar URL
                          if (avatarUrl) {
                            console.warn(
                              "Avatar image failed to load, showing fallback",
                            );
                          }
                        }}
                        onLoad={() => {
                          console.log(
                            "Dashboard Avatar: Image loaded successfully",
                            {
                              avatarUrl: avatarUrl ? "present" : "null",
                            },
                          );
                        }}
                      />
                      <AvatarFallback className="bg-white/20 text-white font-bold text-lg md:text-xl">
                        {firstName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white/80 font-semibold text-sm md:text-lg">
                        Welcome back,
                      </p>
                      <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-6xl font-black text-white tracking-tight">
                        {firstName}
                      </h1>
                    </div>
                  </div>

                  <p className="text-base md:text-xl text-white/90 font-medium leading-relaxed max-w-2xl text-center md:text-left">
                    Your Karachi exploration journey continues. You&apos;re
                    making excellent progress toward becoming a local expert.
                  </p>
                </div>

                {/* Level & Progress + Daily Login */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-stretch gap-4 lg:gap-6">
                  {/* Rank and Progress Cards - Always side by side */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1">
                    {/* Current Rank Card */}
                    <div className="flex items-center space-x-3 bg-white/15 backdrop-blur-sm rounded-2xl p-3 md:p-4 border border-white/20 h-full">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Trophy className="h-5 w-5 md:h-6 md:w-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm md:text-lg truncate">
                          {level.name}
                        </h3>
                        <p className="text-white/80 text-xs md:text-sm">
                          {profile.points} XP
                        </p>
                      </div>
                    </div>

                    {/* Next Rank Progress Card */}
                    {nextLevel ? (
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 md:p-4 border border-white/20 h-full flex flex-col justify-center">
                        <p className="text-white font-semibold text-xs md:text-sm leading-tight">
                          <span className="text-white/80">
                            {nextLevel.minPoints - profile.points}
                          </span>{" "}
                          XP to{" "}
                          <span className="text-white">{nextLevel.name}</span>
                        </p>
                        <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 1.5, delay: 0.5 }}
                            className="h-full bg-white rounded-full"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 md:p-4 border border-white/20 h-full flex items-center justify-center">
                        <p className="text-white font-semibold text-xs md:text-sm text-center">
                          🏆 Max Rank!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Daily Login Button - Inline with rank/points */}
                  <div className="w-full lg:w-auto lg:flex-shrink-0 lg:max-w-xs">
                    <DailyLoginButton />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column - Stats Dashboard (4 columns) */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="lg:col-span-4 space-y-4 md:space-y-6"
            >
              {/* Weekly Points - Large Display */}
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-white/20">
                <div className="text-center space-y-2 md:space-y-3">
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-2xl bg-white/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 md:h-8 md:w-8 text-white" />
                  </div>
                  <div>
                    <AnimatedCounter
                      value={weeklyPointsEarned}
                      className="text-3xl md:text-4xl font-black text-white"
                      duration={2}
                    />
                    <p className="text-white/80 font-semibold text-sm md:text-base">
                      XP This Week
                    </p>
                    <p
                      className={cn(
                        "text-xs md:text-sm font-semibold",
                        isPositiveChange ? "text-white/70" : "text-red-300",
                      )}
                    >
                      {isPositiveChange ? "+" : ""}
                      {weekOverWeekPercentage}% from last week
                    </p>
                  </div>
                </div>
              </div>

              {/* Weekly Stats Grid */}
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/20 text-center">
                  <MapPin className="h-4 w-4 md:h-5 md:w-5 text-white mx-auto mb-1 md:mb-2" />
                  <AnimatedCounter
                    value={weeklyStats.placesVisited}
                    className="text-lg md:text-xl font-bold text-white"
                    duration={1.5}
                  />
                  <p className="text-white/70 text-xs">Places</p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/20 text-center">
                  <Star className="h-4 w-4 md:h-5 md:w-5 text-white mx-auto mb-1 md:mb-2" />
                  <AnimatedCounter
                    value={weeklyStats.reviewsWritten}
                    className="text-lg md:text-xl font-bold text-white"
                    duration={1.5}
                  />
                  <p className="text-white/70 text-xs">Reviews</p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/20 text-center">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-white mx-auto mb-1 md:mb-2" />
                  <AnimatedCounter
                    value={weeklyStats.eventsBooked}
                    className="text-lg md:text-xl font-bold text-white"
                    duration={1.5}
                  />
                  <p className="text-white/70 text-xs">Events</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Weekly Challenges - Below Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <WeeklyChallenges />
      </motion.div>
    </div>
  );
}
