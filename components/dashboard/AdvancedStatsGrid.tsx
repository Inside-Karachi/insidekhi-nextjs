"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  Star,
  Calendar,
  Heart,
  Award,
  TrendingUp,
  TrendingDown,
  BarChart3,
  // Users,
  // MapPin,
  // Clock
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: "primary" | "blue" | "green" | "amber" | "rose" | "purple";
  delay?: number;
  className?: string;
}

function AdvancedStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
  delay = 0,
  className,
}: StatCardProps) {
  const colorClasses = {
    primary: {
      bg: "from-primary/20 via-primary/10 to-primary/5",
      border: "border-primary/30",
      icon: "text-primary",
      accent: "bg-primary",
      glow: "hover:shadow-xl hover:shadow-primary/25",
    },
    blue: {
      bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      border: "border-blue-500/30",
      icon: "text-blue-500",
      accent: "bg-blue-500",
      glow: "hover:shadow-xl hover:shadow-blue-500/25",
    },
    green: {
      bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/30",
      icon: "text-emerald-500",
      accent: "bg-emerald-500",
      glow: "hover:shadow-xl hover:shadow-emerald-500/25",
    },
    amber: {
      bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
      border: "border-amber-500/30",
      icon: "text-amber-500",
      accent: "bg-amber-500",
      glow: "hover:shadow-xl hover:shadow-amber-500/25",
    },
    rose: {
      bg: "from-rose-500/20 via-rose-500/10 to-rose-500/5",
      border: "border-rose-500/30",
      icon: "text-rose-500",
      accent: "bg-rose-500",
      glow: "hover:shadow-xl hover:shadow-rose-500/25",
    },
    purple: {
      bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      border: "border-purple-500/30",
      icon: "text-purple-500",
      accent: "bg-purple-500",
      glow: "hover:shadow-xl hover:shadow-purple-500/25",
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
        colors.glow,
        "transform-gpu",
        className,
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

          {trend && (
            <div
              className={cn(
                "flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold",
                trend.isPositive
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/20 text-red-600 dark:text-red-400",
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.value}%</span>
            </div>
          )}
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
            {subtitle}
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

interface AdvancedStatsGridProps {
  stats: {
    reviews: number;
    bookings: number;
    favorites: number;
    achievements: number;
  };
  trends?: {
    reviews: { value: number; isPositive: boolean };
    bookings: { value: number; isPositive: boolean };
    favorites: { value: number; isPositive: boolean };
    achievements: { value: number; isPositive: boolean };
  };
  className?: string;
}

export function AdvancedStatsGrid({
  stats,
  trends,
  className,
}: AdvancedStatsGridProps) {
  return (
    <div className={cn("space-y-6 md:space-y-8", className)}>
      {/* Section Header */}
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
            Your <span className="gradient-text-primary">Performance</span>
          </h2>
        </div>
        <p className="text-muted-foreground text-sm md:text-lg">
          Track your engagement and activity across the platform
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <AdvancedStatCard
          title="Reviews Written"
          value={stats.reviews}
          subtitle="Total reviews shared"
          icon={<Star className="h-6 w-6" />}
          trend={trends?.reviews}
          color="amber"
          delay={0.1}
        />

        <AdvancedStatCard
          title="Events Booked"
          value={stats.bookings}
          subtitle="Experiences reserved"
          icon={<Calendar className="h-6 w-6" />}
          trend={trends?.bookings}
          color="blue"
          delay={0.2}
        />

        <AdvancedStatCard
          title="Places Saved"
          value={stats.favorites}
          subtitle="Favorite locations"
          icon={<Heart className="h-6 w-6" />}
          trend={trends?.favorites}
          color="rose"
          delay={0.3}
        />

        <AdvancedStatCard
          title="Achievements"
          value={stats.achievements}
          subtitle="Badges earned"
          icon={<Award className="h-6 w-6" />}
          trend={trends?.achievements}
          color="purple"
          delay={0.4}
        />
      </div>
    </div>
  );
}
