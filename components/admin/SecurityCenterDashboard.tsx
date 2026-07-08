"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Shield,
  AlertTriangle,
  Activity,
  Ban,
  RefreshCw,
  TrendingUp,
  Clock,
  MapPin,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import type { Database } from "@/types/supabase";
import { useSecurityAlerts } from "@/hooks/useSecurityAlerts";

// Use Supabase generated types
type SecurityEvent = Database["public"]["Tables"]["security_events"]["Row"];

interface SecuritySummary {
  total_events: number;
  critical_events: number;
  high_events: number;
  medium_events?: number;
  low_events?: number;
  blocked_ips: number;
  rate_limit_violations: number;
  unresolved_events: number;
  failed_logins?: number;
  unique_ips?: number;
  auto_blocked_events?: number;
}

interface SecurityEventWithUser extends SecurityEvent {
  user_email?: string | null;
  user_full_name?: string | null;
}

interface PremiumStatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: "primary" | "rose" | "amber" | "purple" | "yellow" | "orange";
  delay?: number;
  linkHref?: string;
}

function PremiumStatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  delay = 0,
  linkHref,
}: PremiumStatCardProps) {
  const colorClasses = {
    primary: {
      bg: "from-primary/20 via-primary/10 to-primary/5",
      border: "border-primary/30",
      icon: "text-primary",
      glow: "hover:shadow-xl hover:shadow-primary/25",
    },
    rose: {
      bg: "from-rose-500/20 via-rose-500/10 to-rose-500/5",
      border: "border-rose-500/30",
      icon: "text-rose-500",
      glow: "hover:shadow-xl hover:shadow-rose-500/25",
    },
    amber: {
      bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
      border: "border-amber-500/30",
      icon: "text-amber-500",
      glow: "hover:shadow-xl hover:shadow-amber-500/25",
    },
    purple: {
      bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      border: "border-purple-500/30",
      icon: "text-purple-500",
      glow: "hover:shadow-xl hover:shadow-purple-500/25",
    },
    yellow: {
      bg: "from-yellow-500/20 via-yellow-500/10 to-yellow-500/5",
      border: "border-yellow-500/30",
      icon: "text-yellow-500",
      glow: "hover:shadow-xl hover:shadow-yellow-500/25",
    },
    orange: {
      bg: "from-orange-500/20 via-orange-500/10 to-orange-500/5",
      border: "border-orange-500/30",
      icon: "text-orange-500",
      glow: "hover:shadow-xl hover:shadow-orange-500/25",
    },
  };

  const colors = colorClasses[color];

  const CardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="group"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br backdrop-blur-sm transition-all duration-500",
          colors.bg,
          colors.border,
          colors.glow,
          "hover:scale-[1.02]"
        )}
      >
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>

              <div className="flex items-baseline space-x-2">
                <AnimatedCounter
                  value={value}
                  className={cn("text-4xl font-bold", colors.icon)}
                />
              </div>

              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>

            <div
              className={cn(
                "rounded-xl p-3 transition-transform duration-300 group-hover:scale-110",
                colors.bg,
                colors.icon
              )}
            >
              {icon}
            </div>
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/0 via-background/0 to-background/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </motion.div>
  );

  if (linkHref) {
    return <Link href={linkHref}>{CardContent}</Link>;
  }

  return CardContent;
}

export function SecurityCenterDashboard() {
  const [summary, setSummary] = React.useState<SecuritySummary | null>(null);
  const [recentEvents, setRecentEvents] = React.useState<
    SecurityEventWithUser[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState("24");
  const { toast } = useToast();

  // Real-time security alerts
  const { isConnected: realtimeConnected } = useSecurityAlerts({
    enableNotifications: false, // Notifications handled by badge
    severityLevels: ["critical", "high"],
  });

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch summary
      const summaryRes = await fetch(
        `/api/admin/security/summary?hours=${timeRange}`
      );

      if (!summaryRes.ok) {
        throw new Error("Failed to fetch security summary");
      }

      const summaryData = await summaryRes.json();

      if (summaryData.summary) {
        setSummary(summaryData.summary[0] || null);
      }

      // Fetch recent events
      const eventsRes = await fetch(
        `/api/admin/security/events?limit=10&resolved=false`
      );

      if (!eventsRes.ok) {
        throw new Error("Failed to fetch security events");
      }

      const eventsData = await eventsRes.json();

      if (eventsData.events) {
        setRecentEvents(eventsData.events);
      }
    } catch (error) {
      console.error("[SECURITY DASHBOARD] Error:", error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load security data. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Time Range:
          </span>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last Hour</SelectItem>
              <SelectItem value="24">Last 24 Hours</SelectItem>
              <SelectItem value="168">Last Week</SelectItem>
              <SelectItem value="720">Last Month</SelectItem>
            </SelectContent>
          </Select>

          {/* Real-time Connection Status */}
          {realtimeConnected && (
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1.5"
            >
              <motion.div
                className="h-2 w-2 rounded-full bg-green-500"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              Live Monitoring
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <PremiumStatCard
          title="Total Events"
          value={isLoading ? 0 : summary?.total_events || 0}
          subtitle={`Last ${timeRange} hours`}
          icon={<Activity className="h-6 w-6" />}
          color="primary"
          delay={0.1}
        />

        <PremiumStatCard
          title="Critical Events"
          value={isLoading ? 0 : summary?.critical_events || 0}
          subtitle="Requires immediate attention"
          icon={<AlertTriangle className="h-6 w-6" />}
          color="rose"
          delay={0.2}
        />

        <PremiumStatCard
          title="Unresolved Events"
          value={isLoading ? 0 : summary?.unresolved_events || 0}
          subtitle="Pending investigation"
          icon={<Shield className="h-6 w-6" />}
          color="amber"
          delay={0.3}
        />

        <PremiumStatCard
          title="Blocked IPs"
          value={isLoading ? 0 : summary?.blocked_ips || 0}
          subtitle="Currently blocked"
          icon={<Ban className="h-6 w-6" />}
          color="purple"
          delay={0.4}
          linkHref="/admin/security/blocked-ips"
        />

        <PremiumStatCard
          title="Rate Violations"
          value={isLoading ? 0 : summary?.rate_limit_violations || 0}
          subtitle="API rate limit violations"
          icon={<TrendingUp className="h-6 w-6" />}
          color="yellow"
          delay={0.5}
        />

        <PremiumStatCard
          title="High Severity"
          value={isLoading ? 0 : summary?.high_events || 0}
          subtitle="High severity incidents"
          icon={<AlertTriangle className="h-6 w-6" />}
          color="orange"
          delay={0.6}
        />
      </div>

      {/* Recent Events */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recent Unresolved Events</h2>
          <Link href="/admin/security/events">
            <Button variant="outline" size="sm" className="gap-2">
              View All Events
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p>Loading events...</p>
          </div>
        ) : recentEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 px-4 rounded-2xl border border-dashed border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-primary/5"
          >
            <Shield className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
            <p className="text-lg font-medium mb-1">All Clear!</p>
            <p className="text-sm text-muted-foreground">
              No unresolved security events
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group relative overflow-hidden rounded-xl border bg-card p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", getSeverityColor(event.severity))}
                  >
                    {event.severity}
                  </Badge>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {event.event_type.replace(/_/g, " ").toUpperCase()}
                      </p>
                      {event.user_email && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {event.user_email}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {event.ip_address ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          <span>{String(event.ip_address)}</span>
                          {event.city && event.country_code ? (
                            <span className="opacity-75">
                              ({String(event.city)},{" "}
                              {String(event.country_code)})
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(event.created_at || "").toLocaleString()}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/security/events" className="group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
          >
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Security Events</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                View and manage all security events and incidents
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.div>
        </Link>

        <Link href="/admin/security/blocked-ips" className="group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-6 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300"
          >
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Ban className="h-5 w-5 text-purple-500" />
                </div>
                <h3 className="font-semibold">Blocked IPs</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage blocked IP addresses and auto-blocking rules
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.div>
        </Link>

        <Link href="/admin/security/config" className="group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-6 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300"
          >
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="font-semibold">Configuration</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure security thresholds and system settings
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.div>
        </Link>

        <Link href="/admin/security/infrastructure" className="group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300"
          >
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <BarChart3 className="h-5 w-5 text-emerald-500" />
                </div>
                <h3 className="font-semibold">Infrastructure</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor API health, database performance, and metrics
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.div>
        </Link>
      </div>
    </div>
  );
}
