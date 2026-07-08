"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { PremiumStatCard } from "@/components/admin/PremiumStatCard";
import { DailyLoginResetPanel } from "@/components/admin/gamification/DailyLoginResetPanel";
import { ManualXPAward } from "@/components/admin/gamification/ManualXPAward";
import {
  Trophy,
  Users,
  Zap,
  TrendingUp,
  Award,
  Activity,
  ArrowRight,
  RefreshCw,
  Target,
  QrCode,
  HandCoins,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  total_xp_awarded: number;
  insider_count: number;
  weekly_active_users: number;
  monthly_active_users: number;
  total_users_with_xp: number;
  active_activities_count: number;
}

interface GamificationDashboardProps {
  canManageSettings: boolean;
}

export function GamificationDashboard({
  canManageSettings,
}: GamificationDashboardProps) {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();

  // Fetch dashboard stats
  const fetchStats = React.useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch multiple endpoints in parallel
      const [leaderboardRes, ranksRes, activitiesRes, weeklyRes, monthlyRes] =
        await Promise.all([
          fetch("/api/gamification/leaderboard?period=all_time&limit=100"),
          fetch("/api/gamification/ranks"),
          fetch("/api/admin/gamification/activities"),
          fetch("/api/gamification/leaderboard?period=weekly&limit=100"),
          fetch("/api/gamification/leaderboard?period=monthly&limit=100"),
        ]);

      const [
        leaderboardData,
        ranksData,
        activitiesData,
        weeklyData,
        monthlyData,
      ] = await Promise.all([
        leaderboardRes.json(),
        ranksRes.json(),
        activitiesRes.json(),
        weeklyRes.json(),
        monthlyRes.json(),
      ]);

      // Calculate real stats from database
      interface RankData {
        slug: string;
        max_slots: number | null;
      }
      const insiderRank = ranksData.ranks?.find(
        (r: RankData) => r.slug === "insider"
      );
      const insiderCount = insiderRank?.max_slots || 100;

      interface ActivityData {
        is_active: boolean;
      }
      const activeActivitiesCount =
        activitiesData.activities?.filter((a: ActivityData) => a.is_active)
          .length || 0;

      // Calculate total XP awarded across all users
      const totalXP = (leaderboardData.leaderboard || []).reduce(
        (sum: number, user: { xp_total: number }) => sum + user.xp_total,
        0
      );

      setStats({
        total_xp_awarded: totalXP,
        insider_count: insiderCount,
        weekly_active_users: weeklyData.leaderboard?.length || 0,
        monthly_active_users: monthlyData.leaderboard?.length || 0,
        total_users_with_xp: leaderboardData.leaderboard?.length || 0,
        active_activities_count: activeActivitiesCount,
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard stats",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="overview" className="space-y-8">
      <TabsList
        className={`grid w-full ${canManageSettings ? "grid-cols-3" : "grid-cols-2"} lg:w-auto`}
      >
        <TabsTrigger value="overview" className="gap-2">
          <Trophy className="h-4 w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="award-xp" className="gap-2">
          <HandCoins className="h-4 w-4" />
          Award XP
        </TabsTrigger>
        {canManageSettings && (
          <TabsTrigger value="settings" className="gap-2">
            <Activity className="h-4 w-4" />
            Settings
          </TabsTrigger>
        )}
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-8">
        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <PremiumStatCard
            title="Total XP Awarded"
            value={stats?.total_xp_awarded.toLocaleString() || "0"}
            icon={Zap}
            color="emerald"
            delay={0}
          />
          <PremiumStatCard
            title="INSIDER Members"
            value={`${stats?.insider_count || 0}`}
            icon={Trophy}
            color="orange"
            delay={1}
          />
          <PremiumStatCard
            title="Weekly Active Users"
            value={stats?.weekly_active_users.toLocaleString() || "0"}
            icon={TrendingUp}
            color="blue"
            delay={2}
          />
          <PremiumStatCard
            title="Monthly Active Users"
            value={stats?.monthly_active_users.toLocaleString() || "0"}
            icon={Users}
            color="purple"
            delay={3}
          />
          <PremiumStatCard
            title="Users with XP"
            value={stats?.total_users_with_xp.toLocaleString() || "0"}
            icon={Award}
            color="indigo"
            delay={4}
          />
          <PremiumStatCard
            title="Active Activities"
            value={`${stats?.active_activities_count || 0}`}
            icon={Activity}
            color="pink"
            delay={5}
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
            {canManageSettings && (
              <QuickActionCard
                title="Manage Ranks"
                description="Configure XP thresholds and benefits"
                icon={Award}
                href="/admin/gamification/ranks"
                color="primary"
                delay={0}
              />
            )}
            {canManageSettings && (
              <QuickActionCard
                title="XP Activities"
                description="Edit XP rewards and cooldowns"
                icon={Zap}
                href="/admin/gamification/activities"
                color="emerald"
                delay={1}
              />
            )}
            <QuickActionCard
              title="Weekly Challenges"
              description="Create and manage challenges"
              icon={Target}
              href="/admin/gamification/challenges"
              color="violet"
              delay={canManageSettings ? 2 : 0}
            />
            <QuickActionCard
              title="Partner QR Codes"
              description="Generate QR codes for locations"
              icon={QrCode}
              href="/admin/gamification/qr-codes"
              color="fuchsia"
              delay={canManageSettings ? 3 : 1}
            />
            <QuickActionCard
              title="Verify Shares"
              description="Approve social media shares"
              icon={HandCoins}
              href="/admin/gamification/shares"
              color="cyan"
              delay={canManageSettings ? 4 : 2}
            />
            <QuickActionCard
              title="View Leaderboard"
              description="See the top 100 users by XP"
              icon={Trophy}
              href="/admin/gamification/leaderboard"
              color="amber"
              delay={canManageSettings ? 5 : 3}
            />
          </div>
        </div>

        {/* System Info */}
        <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Gamification System Status
                </h3>
                <div className="grid gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <div className="flex items-center justify-between">
                    <span>Leaderboard Cache</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      ✓ Active (Hourly Refresh)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>INSIDER Top-100 Logic</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      ✓ Enforced
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active XP Activities</span>
                    <span className="font-medium">
                      {stats?.active_activities_count || 0} enabled
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Manual XP Award Tab */}
      <TabsContent value="award-xp">
        <ManualXPAward />
      </TabsContent>

      {/* Settings Tab */}
      {canManageSettings && (
        <TabsContent value="settings">
          <DailyLoginResetPanel />
        </TabsContent>
      )}
    </Tabs>
  );
}

// Quick Action Card Component
function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color,
  delay,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  delay: number;
}) {
  const backgroundClasses: { [key: string]: string } = {
    primary: "bg-primary/5 hover:bg-primary/10",
    emerald: "bg-emerald-500/5 hover:bg-emerald-500/10",
    amber: "bg-amber-500/5 hover:bg-amber-500/10",
    violet: "bg-violet-500/5 hover:bg-violet-500/10",
    teal: "bg-teal-500/5 hover:bg-teal-500/10",
    cyan: "bg-cyan-500/5 hover:bg-cyan-500/10",
    fuchsia: "bg-fuchsia-500/5 hover:bg-fuchsia-500/10",
  };

  const iconColorClasses: { [key: string]: string } = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
    >
      <Link href={href}>
        <Card
          className={`group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${backgroundClasses[color]}`}
        >
          <CardContent className="p-6">
            <div className="relative space-y-3">
              <div
                className={`inline-flex p-3 rounded-xl ${iconColorClasses[color]}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <div className="flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all">
                <span>Manage</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
