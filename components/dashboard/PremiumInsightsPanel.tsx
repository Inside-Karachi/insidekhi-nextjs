"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  MapPin,
  Star,
  Calendar,
  Target,
  Zap,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface InsightCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: "amber" | "blue" | "purple" | "green";
  delay?: number;
}

function InsightCard({
  title,
  value,
  subtitle,
  icon,
  color,
  delay = 0,
}: InsightCardProps) {
  const colorClasses = {
    amber: {
      bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
      border: "border-amber-500/30",
      icon: "text-amber-500",
      accent: "bg-amber-500",
      glow: "shadow-amber-500/25",
    },
    blue: {
      bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      border: "border-blue-500/30",
      icon: "text-blue-500",
      accent: "bg-blue-500",
      glow: "shadow-blue-500/25",
    },
    green: {
      bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/30",
      icon: "text-emerald-500",
      accent: "bg-emerald-500",
      glow: "shadow-emerald-500/25",
    },
    purple: {
      bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      border: "border-purple-500/30",
      icon: "text-purple-500",
      accent: "bg-purple-500",
      glow: "shadow-purple-500/25",
    },
  };

  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{
        scale: 1.02,
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 md:p-6 group cursor-pointer",
        "backdrop-blur-xl border transition-all duration-500",
        `bg-gradient-to-br ${colors.bg}`,
        colors.border,
        "hover:shadow-xl",
        // Explicit glow classes for each color to ensure Tailwind generates them
        color === "amber" && "hover:shadow-amber-500/25",
        color === "green" && "hover:shadow-emerald-500/25",
        color === "purple" && "hover:shadow-purple-500/25",
        "transform-gpu",
      )}
    >
      {/* Border glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div
          className={cn(
            "absolute inset-0 rounded-2xl opacity-20 blur-sm",
            colors.accent,
          )}
        />
      </div>

      {/* Animated accent line */}
      <div
        className={cn(
          "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
          colors.accent,
        )}
      />

      <div className="relative z-10">
        {/* Header with icon and trend */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div
            className={cn(
              "relative p-2 md:p-3 rounded-xl transition-all duration-500",
              "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
              `bg-gradient-to-br ${colors.bg}`,
              "border border-white/20 dark:border-white/10",
              "shadow-lg group-hover:shadow-xl",
            )}
          >
            <div className={cn("h-5 w-5 md:h-6 md:w-6", colors.icon)}>
              {icon}
            </div>
          </div>

          <div
            className={cn(
              "flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold",
              "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
            )}
          >
            <span>{subtitle}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-2 md:space-y-3">
          <AnimatedCounter
            value={value}
            className={cn(
              "text-2xl md:text-3xl font-black tracking-tight transition-all duration-500",
              "group-hover:scale-110 transform-gpu",
              "text-foreground",
            )}
            duration={1.8}
          />
          <h3
            className={cn(
              "font-bold text-xs md:text-sm tracking-wide transition-all duration-300",
              "group-hover:translate-x-1",
              "text-foreground",
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              "text-xs font-medium transition-all duration-300",
              "text-muted-foreground",
              "opacity-80",
            )}
          >
            Keep exploring!
          </p>
        </div>

        {/* Shine effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1200 ease-out" />
        </div>
      </div>
    </motion.div>
  );
}

interface RecommendationCardProps {
  title: string;
  subtitle: string;
  rating?: number;
  href: string;
  delay?: number;
}

function RecommendationCard({
  title,
  subtitle,
  rating,
  href,
  delay = 0,
}: RecommendationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{
        scale: 1.02,
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <Link href={href}>
        <div className="relative overflow-hidden rounded-2xl p-6 group cursor-pointer backdrop-blur-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/60 to-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-500">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Animated accent line */}
          <div className="absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          <div className="relative z-10">
            <div className="flex items-start space-x-4">
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg">
                <MapPin className="h-6 w-6 text-primary" />
                {/* Icon glow effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-primary/20 blur-md scale-110" />
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <h4 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors duration-300 truncate">
                  {title}
                </h4>
                <p className="text-sm text-muted-foreground truncate leading-relaxed">
                  {subtitle}
                </p>
                {rating && (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                      <Star className="h-4 w-4 text-amber-500 fill-current" />
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        {rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all duration-300">
                <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </div>

          {/* Shine effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1200 ease-out" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

interface PremiumInsightsPanelProps {
  weeklyStats: {
    placesVisited: number;
    pointsEarned: number;
    streakDays: number;
  };
  recommendations: Array<{
    id: number;
    name: string;
    address: string;
    slug: string;
    rating?: number;
  }>;
  upcomingEvents?: Array<{
    id: number;
    name: string;
    slug: string;
    start_time: string;
  }>;
  showOnlyWeeklyInsights?: boolean;
  className?: string;
}

export function PremiumInsightsPanel({
  weeklyStats,
  recommendations,
  upcomingEvents,
  showOnlyWeeklyInsights = false,
  className,
}: PremiumInsightsPanelProps) {
  return (
    <div className={cn("space-y-12", className)}>
      {/* Weekly Insights */}
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
              Weekly <span className="gradient-text-primary">Insights</span>
            </h2>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground">
            Your exploration patterns and achievements this week
          </p>
        </motion.div>

        {/* Insights Grid - Larger */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <InsightCard
            title="Places Explored"
            value={weeklyStats.placesVisited}
            subtitle="New discoveries"
            icon={<MapPin className="h-6 w-6" />}
            color="amber"
            delay={0.1}
          />

          <InsightCard
            title="XP Earned"
            value={weeklyStats.pointsEarned}
            subtitle="Weekly progress"
            icon={<Zap className="h-6 w-6" />}
            color="green"
            delay={0.2}
          />

          <InsightCard
            title="Active Streak"
            value={weeklyStats.streakDays}
            subtitle="Days in a row"
            icon={<Target className="h-6 w-6" />}
            color="purple"
            delay={0.3}
          />
        </div>
      </div>

      {/* Recommendations Section - Only show if not showOnlyWeeklyInsights */}
      {!showOnlyWeeklyInsights && (
        <div className="space-y-6 md:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                Curated <span className="gradient-text-primary">for You</span>
              </h2>
            </div>
            <p className="text-lg text-muted-foreground">
              Personalized recommendations based on your exploration history
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {recommendations.length > 0 ? (
              recommendations.map((place, index) => (
                <RecommendationCard
                  key={place.id}
                  title={place.name}
                  subtitle={place.address}
                  rating={place.rating}
                  href={`/listings/${place.slug}`}
                  delay={0.1 + index * 0.1}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                className="lg:col-span-2 text-center py-12"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted/50 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No recommendations yet
                </h3>
                <p className="text-muted-foreground">
                  Start exploring to get personalized recommendations!
                </p>
              </motion.div>
            )}
          </div>

          {/* Upcoming Events */}
          {upcomingEvents && upcomingEvents.length > 0 && (
            <div className="border-t border-border pt-8 mt-8">
              <div className="flex items-center space-x-2 mb-6">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  Upcoming Events
                </h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {upcomingEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.4 + index * 0.1,
                      duration: 0.6,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  >
                    <Link href={`/events/${event.slug}`}>
                      <div className="glass-card p-4 rounded-xl group hover:shadow-lg transition-all duration-300">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors duration-300 truncate">
                              {event.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(event.start_time).toLocaleDateString()}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
