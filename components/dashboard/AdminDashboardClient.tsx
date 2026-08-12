"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  Users,
  Calendar,
  MapPin,
  CheckCircle,
  Clock,
  Eye,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { AdminDashboardProps } from "@/types/dashboard.types";
import { PremiumFormActivityHub } from "./PremiumFormActivityHub";
import { DashboardQuickAccess } from "./DashboardQuickAccess";

// --- PremiumStatCard (copied from SuperAdminDashboard for DRY) ---
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
        duration: 0.5,
        delay: delay * 0.1,
        ease: "easeOut",
      }}
      className={`
        relative overflow-hidden rounded-xl border bg-gradient-to-br ${colors.bg} ${colors.border}
        backdrop-blur-sm transition-all duration-300 ${colors.glow}
        hover:border-opacity-50
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="relative p-6">
        <div className="flex items-center justify-between">
          <div
            className={`p-2 rounded-lg bg-gradient-to-br ${colors.bg} ${colors.icon}`}
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

export function AdminDashboardClient({
  user,
  profile,
  dashboardData,
}: AdminDashboardProps) {
  const router = useRouter();
  const { statistics, recentActivity, forms } = dashboardData;

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
      {/* Admin Header (styled like super admin) */}
      <motion.div variants={itemVariants} className="text-center">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-full border border-blue-200/20 mb-4"
        >
          <CheckCircle className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Admin Access
          </span>
        </motion.div>
        <motion.h1
          variants={itemVariants}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight"
        >
          Admin <span className="gradient-text-primary">Dashboard</span>
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="text-muted-foreground mt-2 text-lg"
        >
          Welcome back, {profile?.full_name || user.email}! Manage and monitor
          your platform.
        </motion.p>
      </motion.div>

      {/* Platform Statistics (styled) */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <PremiumStatCard
          title="Total Users"
          value={statistics.totalUsers}
          subtitle="All registered users"
          icon={<Users className="h-4 w-4" />}
          color="primary"
          trend={{ value: 10, isPositive: true }}
          delay={0}
        />
        <PremiumStatCard
          title="Active Events"
          value={statistics.publishedEvents}
          subtitle="Published events"
          icon={<Calendar className="h-4 w-4" />}
          color="blue"
          trend={{ value: 5, isPositive: true }}
          delay={1}
        />
        <PremiumStatCard
          title="Active Listings"
          value={statistics.activeListings}
          subtitle="Published listings"
          icon={<MapPin className="h-4 w-4" />}
          color="purple"
          trend={{ value: 7, isPositive: true }}
          delay={2}
        />
        <PremiumStatCard
          title="Pending Reviews"
          value={statistics.pendingReviews}
          subtitle="Awaiting moderation"
          icon={<Clock className="h-4 w-4 text-orange-500" />}
          color="amber"
          trend={{ value: -2, isPositive: false }}
          delay={3}
        />
      </motion.div>

      {/* Quick Actions (animated, glassmorphic) */}
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
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">User Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage user accounts and permissions
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/30"
              data-route-nav
              onClick={() => router.push("/admin/users")}
            >
              Manage Users
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
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Review Management</h3>
                <p className="text-sm text-muted-foreground">
                  Moderate and manage user reviews
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-green-500/10 hover:bg-green-500/20 text-green-600 border-green-500/30"
              data-route-nav
              onClick={() => router.push("/admin/reviews")}
            >
              Manage Reviews
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
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Listing Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage business listings and content
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border-purple-500/30"
              data-route-nav
              onClick={() => router.push("/admin/listings")}
            >
              Manage Listings
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Access — full admin toolset, same routes as the sidebar */}
      <motion.div variants={itemVariants}>
        <DashboardQuickAccess role="admin" max={Infinity} />
      </motion.div>

      {/* Recent Activity (animated, glassmorphic) */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Recent Events */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="relative overflow-hidden rounded-2xl p-6 group cursor-pointer border bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative p-3 rounded-xl bg-gradient-to-br from-blue-500/15 via-blue-500/8 to-blue-500/3 border border-blue-500/15 group-hover:scale-105 transition-all duration-300 shadow-sm">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 bg-blue-500/10 blur-sm" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Recent Events</h3>
                <p className="text-sm text-muted-foreground">
                  Latest event submissions and status updates
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {recentActivity.events?.slice(0, 3).map((event) => (
                <a
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-blue-200/30 bg-gradient-to-br from-blue-100/40 via-blue-50/30 to-white/10 dark:from-blue-900/30 dark:via-blue-900/10 dark:to-transparent transition-colors duration-200 group hover:border-blue-400/50 hover:bg-blue-50/60 dark:hover:bg-blue-800/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  tabIndex={0}
                  aria-label={`View event: ${event.name}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        {event.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(event.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                      event.status === "published"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                    }`}
                  >
                    {event.status}
                  </span>
                </a>
              )) || <p className="text-muted-foreground">No recent events</p>}
            </div>
          </div>
        </motion.div>

        {/* Recent Listings */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="relative overflow-hidden rounded-2xl p-6 group cursor-pointer border bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative p-3 rounded-xl bg-gradient-to-br from-purple-500/15 via-purple-500/8 to-purple-500/3 border border-purple-500/15 group-hover:scale-105 transition-all duration-300 shadow-sm">
                <MapPin className="h-5 w-5 text-purple-500" />
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 bg-purple-500/10 blur-sm" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Recent Listings</h3>
                <p className="text-sm text-muted-foreground">
                  Latest business listing submissions
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {recentActivity.listings?.slice(0, 3).map((listing) => (
                <a
                  key={listing.id}
                  href={`/admin/listings/${listing.id}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-purple-200/30 bg-gradient-to-br from-purple-100/40 via-purple-50/30 to-white/10 dark:from-purple-900/30 dark:via-purple-900/10 dark:to-transparent transition-colors duration-200 group hover:border-purple-400/50 hover:bg-purple-50/60 dark:hover:bg-purple-800/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  tabIndex={0}
                  aria-label={`View listing: ${listing.name}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-purple-900 dark:text-purple-100">
                        {listing.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                      listing.status === "published"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                    }`}
                  >
                    {listing.status}
                  </span>
                </a>
              )) || <p className="text-muted-foreground">No recent listings</p>}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Form Activity Hub - Moved after Recent Activity for better hierarchy */}
      {forms && (
        <motion.div variants={itemVariants}>
          <PremiumFormActivityHub forms={forms} />
        </motion.div>
      )}

      {/* System Alerts (styled) */}
      {/* System Alerts (animated, glassmorphic) */}
      <motion.div variants={itemVariants}>
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="relative overflow-hidden rounded-2xl p-6 border bg-gradient-to-br from-amber-400/10 via-amber-200/5 to-transparent border-amber-400/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-amber-400/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 animate-pulse" />
            <div>
              <h3 className="font-semibold text-lg">System Alerts</h3>
              <p className="text-sm text-muted-foreground">
                No critical alerts at this time. All systems operational.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
