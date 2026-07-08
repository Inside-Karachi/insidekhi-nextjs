"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Store,
  MapPin,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Play,
  Settings,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ScraperConfig } from "./ScraperConfig";
import { ProgressMonitor } from "./ProgressMonitor";
import { SyncHistory } from "./SyncHistory";

interface ListingScraperDashboardProps {
  initialStats: {
    totalListings: number;
    draftListings: number;
    publishedListings: number;
    totalBranches: number;
  };
  recentListings: Array<{
    id: number;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
    custom_attributes: unknown;
    category_id: number | null;
  }>;
}

// Stat card
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: "violet" | "emerald" | "blue" | "amber";
  delay?: number;
}

function PremiumStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  delay = 0,
}: StatCardProps) {
  const colorClasses = {
    violet: {
      bg: "from-violet-500/20 via-violet-500/10 to-violet-500/5",
      border: "border-violet-500/30",
      icon: "text-violet-500",
      glow: "hover:shadow-xl hover:shadow-violet-500/25",
    },
    emerald: {
      bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/30",
      icon: "text-emerald-500",
      glow: "hover:shadow-xl hover:shadow-emerald-500/25",
    },
    blue: {
      bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      border: "border-blue-500/30",
      icon: "text-blue-500",
      glow: "hover:shadow-xl hover:shadow-blue-500/25",
    },
    amber: {
      bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
      border: "border-amber-500/30",
      icon: "text-amber-500",
      glow: "hover:shadow-xl hover:shadow-amber-500/25",
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
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br",
        colors.bg,
        colors.border,
        "backdrop-blur-sm transition-all duration-300",
        colors.glow,
        "hover:border-opacity-50",
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="relative p-6">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "p-2 rounded-lg bg-gradient-to-br",
              colors.bg,
              colors.icon,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
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
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {title}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function ListingScraperDashboard({
  initialStats,
  recentListings,
}: ListingScraperDashboardProps) {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [isRunning, setIsRunning] = React.useState(false);

  // Listen for sync start event to auto-switch to progress tab
  React.useEffect(() => {
    const handleSyncStart = () => {
      setActiveTab("progress");
      setIsRunning(true);
    };

    window.addEventListener("scraper-sync-started", handleSyncStart);
    return () =>
      window.removeEventListener("scraper-sync-started", handleSyncStart);
  }, []);

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PremiumStatCard
          title="Total Listings"
          value={initialStats.totalListings}
          subtitle="Synced from Peekaboo"
          icon={Store}
          color="violet"
          delay={0}
        />
        <PremiumStatCard
          title="Published"
          value={initialStats.publishedListings}
          subtitle="Live on website"
          icon={CheckCircle}
          color="emerald"
          delay={1}
        />
        <PremiumStatCard
          title="Draft"
          value={initialStats.draftListings}
          subtitle="Pending review"
          icon={Clock}
          color="amber"
          delay={2}
        />
        <PremiumStatCard
          title="Total Branches"
          value={initialStats.totalBranches}
          subtitle="Location records"
          icon={MapPin}
          color="blue"
          delay={3}
        />
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2" disabled={!isRunning}>
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Progress</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-xl border bg-card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button
                  onClick={() => setActiveTab("config")}
                  className="w-full justify-start gap-2"
                  variant="outline"
                  disabled={isRunning}
                >
                  <Play className="h-4 w-4" />
                  Start New Sync
                </Button>
                <Button
                  onClick={() => setActiveTab("history")}
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <Clock className="h-4 w-4" />
                  View Sync History
                </Button>
                <Button
                  onClick={() => setActiveTab("config")}
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <Settings className="h-4 w-4" />
                  Configure Settings
                </Button>
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-xl border bg-card p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Recent Listings</h3>
              {recentListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No listings synced yet
                  </p>
                  <Button
                    onClick={() => setActiveTab("config")}
                    variant="link"
                    className="mt-2"
                  >
                    Start your first sync →
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {recentListings.slice(0, 5).map((listing) => {
                    const lastSync = (
                      listing.custom_attributes as Record<string, unknown>
                    )?.peekaboo_last_sync as string | undefined;

                    return (
                      <div
                        key={listing.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {listing.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lastSync
                              ? `Synced ${new Date(
                                  lastSync,
                                ).toLocaleDateString()}`
                              : "Recently added"}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            listing.status === "published"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {listing.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <ScraperConfig onRunningChange={setIsRunning} />
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          <ProgressMonitor
            onSyncComplete={() => {
              setIsRunning(false);
              setActiveTab("history");
            }}
            onSyncFailed={() => {
              setIsRunning(false);
            }}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <SyncHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
