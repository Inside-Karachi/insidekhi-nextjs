"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, Share2, TrendingUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteModal } from "@/components/gamification/InviteModal";
import { useInviteShare } from "@/hooks/useInviteShare";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";

export function InviteShareDashboardSection() {
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const { stats, refreshStats, isLoading } = useInviteShare();

  React.useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  if (isLoading && !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-12 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Share2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Invite <span className="gradient-text-primary">Rewards</span>
              </h2>
            </div>
            <p className="text-muted-foreground text-sm md:text-lg">
              Earn XP by inviting friends and sharing amazing places
            </p>
          </motion.div>

          <Button
            onClick={() => setShowInviteModal(true)}
            className="w-full md:w-auto bg-gradient-to-r from-primary to-rose-600 hover:from-primary/90 hover:to-rose-600/90 text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 self-start md:self-center"
          >
            <Send className="w-4 h-4 mr-2" />
            Invite Friends
          </Button>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-3">
          <StatCard
            title="Invites Sent"
            value={stats?.total_invitations_sent || 0}
            subtitle={`${stats?.total_invitations_accepted || 0} accepted`}
            icon={Users}
            color="indigo"
            delay={0}
          />
          <StatCard
            title="Content Shared"
            value={stats?.total_shares_created || 0}
            subtitle={`${stats?.total_shares_verified || 0} verified • ${
              stats?.total_shares_rejected || 0
            } rejected`}
            icon={Share2}
            color="purple"
            delay={0.1}
          />
          <StatCard
            title="XP Earned"
            value={
              (stats?.total_xp_from_invites || 0) +
              (stats?.total_xp_from_shares || 0)
            }
            subtitle="From invites & shares"
            icon={TrendingUp}
            color="pink"
            delay={0.2}
          />
        </div>
      </div>

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSuccess={() => {
          refreshStats();
        }}
      />
    </>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: "indigo" | "purple" | "pink";
  delay: number;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  delay,
}: StatCardProps) {
  const colorClasses = {
    indigo: {
      bg: "from-indigo-500/20 via-indigo-500/10 to-indigo-500/5",
      border: "border-indigo-500/30",
      icon: "text-indigo-500",
      accent: "bg-indigo-500",
      glow: "hover:shadow-xl hover:shadow-indigo-500/25",
    },
    purple: {
      bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      border: "border-purple-500/30",
      icon: "text-purple-500",
      accent: "bg-purple-500",
      glow: "hover:shadow-xl hover:shadow-purple-500/25",
    },
    pink: {
      bg: "from-pink-500/20 via-pink-500/10 to-pink-500/5",
      border: "border-pink-500/30",
      icon: "text-pink-500",
      accent: "bg-pink-500",
      glow: "hover:shadow-xl hover:shadow-pink-500/25",
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
        {/* Header with icon */}
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
              <Icon className="w-full h-full" />
            </div>
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
