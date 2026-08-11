"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";
import {
  Building,
  TrendingUp,
  TrendingDown,
  Eye,
  Star,
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";

// Import centralized types
import type { ListerDashboardProps } from "@/types/dashboard.types";
import { DashboardQuickAccess } from "./DashboardQuickAccess";

interface PremiumStatCardProps {
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
}

function PremiumStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
  delay = 0,
}: PremiumStatCardProps) {
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

  const config = colorClasses[color];

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
        duration: 0.5,
        delay: delay * 0.1,
        ease: "easeOut",
      }}
      className={`
        relative overflow-hidden rounded-xl border bg-gradient-to-br ${config.bg} ${config.border}
        backdrop-blur-sm transition-all duration-300 ${config.glow}
        hover:border-opacity-50
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="relative p-6">
        <div className="flex items-center justify-between">
          <div
            className={`p-2 rounded-lg bg-gradient-to-br ${config.bg} ${config.icon}`}
          >
            {icon}
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${
                trend.isPositive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold">
            <AnimatedCounter value={value} />
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>
    </motion.div>
  );
}

function PremiumActivityItem({
  activity,
  index,
  isLast,
}: {
  activity: {
    type: "success" | "warning" | "info" | "error";
    content: string;
    time: string;
    icon: React.ReactNode;
  };
  index: number;
  isLast: boolean;
}) {
  const getActivityConfig = (type: string) => {
    switch (type) {
      case "success":
        return {
          color: "text-green-500",
          bg: "bg-green-500/10 dark:bg-green-500/20",
          border: "border-green-500/20",
        };
      case "warning":
        return {
          color: "text-amber-500",
          bg: "bg-amber-500/10 dark:bg-amber-500/20",
          border: "border-amber-500/20",
        };
      case "error":
        return {
          color: "text-red-500",
          bg: "bg-red-500/10 dark:bg-red-500/20",
          border: "border-red-500/20",
        };
      case "info":
        return {
          color: "text-blue-500",
          bg: "bg-blue-500/10 dark:bg-blue-500/20",
          border: "border-blue-500/20",
        };
      default:
        return {
          color: "text-primary",
          bg: "bg-primary/10 dark:bg-primary/20",
          border: "border-primary/20",
        };
    }
  };

  const config = getActivityConfig(activity.type);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="relative flex items-start space-x-4 group"
    >
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-6 top-14 w-0.5 h-16 bg-gradient-to-b from-border to-transparent" />
      )}

      {/* Activity icon */}
      <div
        className={cn(
          "relative z-10 w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300",
          "group-hover:scale-105 group-hover:shadow-md",
          config.bg,
          config.border,
          config.color,
        )}
      >
        {activity.icon}
      </div>

      {/* Activity content */}
      <div className="flex-1 min-w-0">
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-xl p-4 border border-border/30 bg-gradient-to-br from-background/40 via-background/20 to-transparent group-hover:border-primary/20 group-hover:shadow-md group-hover:shadow-primary/5 transition-all duration-300"
        >
          {/* Subtle hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-transparent to-primary/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <p className="font-medium text-foreground group-hover:text-primary transition-colors duration-300">
                  {activity.content}
                </p>

                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{activity.time}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function ListerDashboard({
  user,
  profile,
  dashboardData,
}: ListerDashboardProps) {
  const router = useRouter();
  const { statistics, recentActivity } = dashboardData;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Lister Header - Matching SuperAdmin Quality */}
      <motion.div variants={itemVariants} className="text-center">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-full border border-primary/20 mb-4"
        >
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            Content Manager Dashboard
          </span>
        </motion.div>
        <motion.h1
          variants={itemVariants}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight"
        >
          Platform Content{" "}
          <span className="gradient-text-primary">Management</span>
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="text-muted-foreground mt-2 text-lg"
        >
          Welcome back, {profile?.full_name || user.email}! Full platform
          content oversight and management.
        </motion.p>
      </motion.div>

      {/* Platform Statistics Overview */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <PremiumStatCard
          title="Total Listings"
          value={statistics.totalListings}
          subtitle="All platform listings"
          icon={<Building className="h-4 w-4" />}
          color="primary"
          trend={{
            value: Math.max(
              0,
              statistics.activeListings -
                Math.max(1, Math.floor(statistics.totalListings * 0.7)),
            ),
            isPositive: true,
          }}
          delay={0}
        />

        <PremiumStatCard
          title="Published Listings"
          value={statistics.activeListings}
          subtitle="Live & visible"
          icon={<Eye className="h-4 w-4" />}
          color="green"
          trend={{ value: 8, isPositive: true }}
          delay={1}
        />

        <PremiumStatCard
          title="Total Events"
          value={statistics.totalEvents}
          subtitle="All platform events"
          icon={<Calendar className="h-4 w-4" />}
          color="blue"
          trend={{
            value: statistics.publishedEvents > 0 ? 5 : 0,
            isPositive: statistics.publishedEvents > 0,
          }}
          delay={2}
        />

        <PremiumStatCard
          title="Published Events"
          value={statistics.publishedEvents}
          subtitle="Live events"
          icon={<Calendar className="h-4 w-4" />}
          color="amber"
          trend={{ value: 8, isPositive: true }}
          delay={3}
        />
      </motion.div>

      {/* Quick Access — same routes as the sidebar */}
      <motion.div variants={itemVariants}>
        <DashboardQuickAccess role="lister" />
      </motion.div>

      {/* User & Review Statistics */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <PremiumStatCard
          title="Total Users"
          value={statistics.totalUsers}
          subtitle="Registered users"
          icon={<Activity className="h-4 w-4" />}
          color="primary"
          trend={{ value: 15, isPositive: true }}
          delay={4}
        />

        <PremiumStatCard
          title="Active Users"
          value={statistics.activeUsers}
          subtitle="Last 30 days"
          icon={<Activity className="h-4 w-4" />}
          color="green"
          trend={{ value: 8, isPositive: true }}
          delay={5}
        />

        <PremiumStatCard
          title="Total Reviews"
          value={statistics.totalReviews}
          subtitle="All reviews"
          icon={<Star className="h-4 w-4" />}
          color="blue"
          trend={{ value: 22, isPositive: true }}
          delay={6}
        />

        <PremiumStatCard
          title="Pending Reviews"
          value={statistics.pendingReviews}
          subtitle="Awaiting moderation"
          icon={<Star className="h-4 w-4" />}
          color="rose"
          trend={{ value: -3, isPositive: true }}
          delay={7}
        />
      </motion.div>

      {/* Quick Actions - Matching SuperAdmin Quality */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500 group-hover:bg-blue-500/30 transition-colors">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Listings</h3>
                <p className="text-sm text-muted-foreground">
                  Review and moderate business listings
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/30"
              data-route-nav
              onClick={() => router.push("/admin/listings")}
            >
              View Listings
            </Button>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-green-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/20 text-green-500 group-hover:bg-green-500/30 transition-colors">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Events</h3>
                <p className="text-sm text-muted-foreground">
                  Oversee event publications
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-green-500/10 hover:bg-green-500/20 text-green-600 border-green-500/30"
              data-route-nav
              onClick={() => router.push("/admin/events")}
            >
              View Events
            </Button>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-500 group-hover:bg-purple-500/30 transition-colors">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Review Moderation</h3>
                <p className="text-sm text-muted-foreground">
                  Moderate user reviews and ratings
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border-purple-500/30"
              data-route-nav
              onClick={() => router.push("/admin/reviews")}
            >
              Moderate Reviews
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* Recent Activity - Dual Section Layout like SuperAdmin */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Content Activity */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="relative overflow-hidden rounded-2xl p-6 group cursor-pointer border border-border/30 bg-gradient-to-br from-background/40 via-background/20 to-transparent hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
        >
          {/* Subtle hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Refined accent line */}
          <div className="absolute top-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 ease-out bg-gradient-to-r from-primary/60 to-primary/30" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative p-3 rounded-xl bg-gradient-to-br from-blue-500/15 via-blue-500/8 to-blue-500/3 border border-blue-500/15 group-hover:scale-105 transition-all duration-300 shadow-sm">
                <Activity className="h-5 w-5 text-blue-500" />
                {/* Subtle icon glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 bg-blue-500/10 blur-sm" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Content Activity</h3>
                <p className="text-sm text-muted-foreground">
                  Recent platform content updates
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Recent listing creation */}
              {recentActivity.listings?.[0] && (
                <PremiumActivityItem
                  activity={{
                    type:
                      recentActivity.listings[0].status === "published"
                        ? "success"
                        : "info",
                    content: `Listing "${recentActivity.listings[0].name}" was ${recentActivity.listings[0].status}`,
                    time: new Date(
                      recentActivity.listings[0].created_at,
                    ).toLocaleDateString(),
                    icon: <Building className="h-4 w-4" />,
                  }}
                  index={0}
                  isLast={false}
                />
              )}

              {/* Recent event creation */}
              {recentActivity.events?.[0] && (
                <PremiumActivityItem
                  activity={{
                    type:
                      recentActivity.events[0].status === "published"
                        ? "success"
                        : "info",
                    content: `Event "${recentActivity.events[0].name}" was ${recentActivity.events[0].status}`,
                    time: new Date(
                      recentActivity.events[0].created_at,
                    ).toLocaleDateString(),
                    icon: <Calendar className="h-4 w-4" />,
                  }}
                  index={1}
                  isLast={false}
                />
              )}

              {/* Recent listing update */}
              {recentActivity.listings?.[1] && (
                <PremiumActivityItem
                  activity={{
                    type: "info",
                    content: `Listing "${recentActivity.listings[1].name}" updated`,
                    time: new Date(
                      recentActivity.listings[1].created_at,
                    ).toLocaleDateString(),
                    icon: <Building className="h-4 w-4" />,
                  }}
                  index={2}
                  isLast={true}
                />
              )}

              {/* Fallback if no recent activity */}
              {!recentActivity.listings?.[0] && !recentActivity.events?.[0] && (
                <PremiumActivityItem
                  activity={{
                    type: "success",
                    content: "Content management system running smoothly",
                    time: new Date().toLocaleDateString(),
                    icon: <Star className="h-4 w-4" />,
                  }}
                  index={0}
                  isLast={true}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* Review Management */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="relative overflow-hidden rounded-2xl p-6 group cursor-pointer border border-border/30 bg-gradient-to-br from-background/40 via-background/20 to-transparent hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
        >
          {/* Subtle hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Refined accent line */}
          <div className="absolute top-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 ease-out bg-gradient-to-r from-primary/60 to-primary/30" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative p-3 rounded-xl bg-gradient-to-br from-purple-500/15 via-purple-500/8 to-purple-500/3 border border-purple-500/15 group-hover:scale-105 transition-all duration-300 shadow-sm">
                <Star className="h-5 w-5 text-purple-500" />
                {/* Subtle icon glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 bg-purple-500/10 blur-sm" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Review Management</h3>
                <p className="text-sm text-muted-foreground">
                  Recent review activities
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Pending reviews alert */}
              {statistics.pendingReviews > 0 && (
                <PremiumActivityItem
                  activity={{
                    type: "warning",
                    content: `${statistics.pendingReviews} reviews awaiting moderation`,
                    time: "Requires attention",
                    icon: <AlertTriangle className="h-4 w-4" />,
                  }}
                  index={0}
                  isLast={statistics.pendingReviews === 0}
                />
              )}

              {/* Recent review activity */}
              <PremiumActivityItem
                activity={{
                  type: "info",
                  content: "Review moderation system active",
                  time: new Date().toLocaleDateString(),
                  icon: <Star className="h-4 w-4" />,
                }}
                index={1}
                isLast={true}
              />

              {/* Fallback if no pending reviews */}
              {statistics.pendingReviews === 0 && (
                <PremiumActivityItem
                  activity={{
                    type: "success",
                    content: "All reviews are up to date",
                    time: "No action needed",
                    icon: <Star className="h-4 w-4" />,
                  }}
                  index={0}
                  isLast={true}
                />
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
