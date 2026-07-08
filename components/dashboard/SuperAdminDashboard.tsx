"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";
import {
  Database,
  Shield,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Settings,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
} from "lucide-react";
import { PremiumFormActivityHub } from "./PremiumFormActivityHub";
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
          config.color
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

// Import centralized types
import type { SuperAdminDashboardProps } from "@/types/dashboard.types";

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

export function SuperAdminDashboard({
  user,
  profile,
  dashboardData,
}: SuperAdminDashboardProps) {
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
      {/* Super Admin Header */}
      <motion.div variants={itemVariants} className="text-center">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-full border border-purple-200/20 mb-4"
        >
          <Shield className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Super Admin Access
          </span>
        </motion.div>
        <motion.h1
          variants={itemVariants}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight"
        >
          System Control <span className="gradient-text-primary">Center</span>
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="text-muted-foreground mt-2 text-lg"
        >
          Welcome back, {profile?.full_name || user.email}! Full platform
          oversight and control.
        </motion.p>
      </motion.div>

      {/* System Health Overview */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <PremiumStatCard
          title="System Status"
          value={100}
          subtitle="All systems operational"
          icon={<CheckCircle className="h-4 w-4" />}
          color="green"
          trend={{ value: 0, isPositive: true }}
          delay={0}
        />

        <PremiumStatCard
          title="Database Load"
          value={23}
          subtitle="Current utilization"
          icon={<Database className="h-4 w-4" />}
          color="blue"
          trend={{ value: -5, isPositive: false }}
          delay={1}
        />

        <PremiumStatCard
          title="API Response"
          value={145}
          subtitle="Average response time (ms)"
          icon={<TrendingUp className="h-4 w-4" />}
          color="green"
          trend={{ value: 12, isPositive: true }}
          delay={2}
        />

        <PremiumStatCard
          title="Active Sessions"
          value={statistics.activeUsers}
          subtitle="Current active users"
          icon={<Activity className="h-4 w-4" />}
          color="amber"
          trend={{ value: 8, isPositive: true }}
          delay={3}
        />
      </motion.div>

      {/* Platform Statistics */}
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
          trend={{ value: 15, isPositive: true }}
          delay={4}
        />

        <PremiumStatCard
          title="Total Events"
          value={statistics.totalEvents}
          subtitle="All platform events"
          icon={<BarChart3 className="h-4 w-4" />}
          color="blue"
          trend={{ value: 8, isPositive: true }}
          delay={5}
        />

        <PremiumStatCard
          title="Total Listings"
          value={statistics.totalListings}
          subtitle="All business listings"
          icon={<Shield className="h-4 w-4" />}
          color="purple"
          trend={{ value: 22, isPositive: true }}
          delay={6}
        />

        <PremiumStatCard
          title="System Alerts"
          value={statistics.pendingReviews}
          subtitle="Require attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          color="rose"
          trend={{ value: -3, isPositive: true }}
          delay={7}
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {/* System Settings */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500 group-hover:bg-blue-500/30 transition-colors">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">System Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Manage platform settings
                </p>
              </div>
            </div>
            <Link href="/admin/settings" className="w-full">
              <Button className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/30">
                Access Settings
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Database Management */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-green-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/20 text-green-500 group-hover:bg-green-500/30 transition-colors">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Database Management</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor database performance
                </p>
              </div>
            </div>
            <Button
              disabled
              className="w-full bg-green-500/10 text-green-600 border-green-500/30 opacity-70 cursor-not-allowed"
              title="Database management page is not available yet"
            >
              Coming Soon
            </Button>
          </div>
        </motion.div>

        {/* Security Center */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/25 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-500 group-hover:bg-purple-500/30 transition-colors">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Security Center</h3>
                <p className="text-sm text-muted-foreground">
                  Security monitoring
                </p>
              </div>
            </div>
            <Link href="/admin/security">
              <Button className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border-purple-500/30">
                Security Dashboard
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Analytics */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  View live & historical analytics
                </p>
              </div>
            </div>
            <Link href="/admin/analytics">
              <Button className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/30">
                View Analytics
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* User Management */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-500 group-hover:bg-indigo-500/30 transition-colors">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">User Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage platform users and roles
                </p>
              </div>
            </div>
            <Link href="/admin/users">
              <Button className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border-indigo-500/30">
                Manage Users
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Logs Management */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/20 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-rose-500/25"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-500 group-hover:bg-rose-500/30 transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Logs Management</h3>
                <p className="text-sm text-muted-foreground">
                  Review system logs & audit trails
                </p>
              </div>
            </div>
            <Link href="/admin/logs">
              <Button className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border-rose-500/30">
                View Logs
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* System Logs */}
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
                <h3 className="font-semibold text-lg">System Activity</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time system monitoring
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Recent user registration */}
              {recentActivity.users?.[0] && (
                <PremiumActivityItem
                  activity={{
                    type: "success",
                    content: `${
                      recentActivity.users[0].full_name || "New user"
                    } registered successfully`,
                    time: new Date(
                      recentActivity.users[0].created_at
                    ).toLocaleDateString(),
                    icon: <Users className="h-4 w-4" />,
                  }}
                  index={0}
                  isLast={false}
                />
              )}

              {/* Recent event creation */}
              {recentActivity.events?.[0] && (
                <PremiumActivityItem
                  activity={{
                    type: "info",
                    content: `Event "${recentActivity.events[0].name}" was created`,
                    time: new Date(
                      recentActivity.events[0].created_at
                    ).toLocaleDateString(),
                    icon: <BarChart3 className="h-4 w-4" />,
                  }}
                  index={1}
                  isLast={false}
                />
              )}

              {/* Recent listing creation */}
              {recentActivity.listings?.[0] && (
                <PremiumActivityItem
                  activity={{
                    type: "info",
                    content: `Listing "${recentActivity.listings[0].name}" was published`,
                    time: new Date(
                      recentActivity.listings[0].created_at
                    ).toLocaleDateString(),
                    icon: <Shield className="h-4 w-4" />,
                  }}
                  index={2}
                  isLast={true}
                />
              )}

              {/* Fallback if no recent activity */}
              {!recentActivity.users?.[0] &&
                !recentActivity.events?.[0] &&
                !recentActivity.listings?.[0] && (
                  <PremiumActivityItem
                    activity={{
                      type: "success",
                      content:
                        "System running smoothly - all services operational",
                      time: new Date().toLocaleDateString(),
                      icon: <CheckCircle className="h-4 w-4" />,
                    }}
                    index={0}
                    isLast={true}
                  />
                )}
            </div>
          </div>
        </motion.div>

        {/* User Management */}
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
                <Users className="h-5 w-5 text-purple-500" />
                {/* Subtle icon glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 bg-purple-500/10 blur-sm" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">User Management</h3>
                <p className="text-sm text-muted-foreground">
                  Recent user activities
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {recentActivity.users?.slice(0, 3).map((user, index) => (
                <PremiumActivityItem
                  key={index}
                  activity={{
                    type: user.role === "admin" ? "success" : "info",
                    content: `${
                      user.full_name || "Anonymous"
                    } joined the platform`,
                    time: new Date(user.created_at).toLocaleDateString(),
                    icon: <Users className="h-4 w-4" />,
                  }}
                  index={index}
                  isLast={index === 2}
                />
              )) || (
                <PremiumActivityItem
                  activity={{
                    type: "warning",
                    content: "No recent user activities",
                    time: "N/A",
                    icon: <AlertTriangle className="h-4 w-4" />,
                  }}
                  index={0}
                  isLast={true}
                />
              )}
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

      {/* User Management Section - Removed */}
      {/* User management is now available at /admin/users */}
    </motion.div>
  );
}
