"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MapPin, Calendar, Star, User, Heart, Trophy, Zap } from "lucide-react";

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  color: "primary" | "blue" | "green" | "amber" | "purple" | "rose";
  delay?: number;
  className?: string;
}

function PremiumActionCard({
  title,
  subtitle,
  icon,
  href,
  onClick,
  color,
  delay = 0,
  className,
}: ActionCardProps) {
  const colorClasses = {
    primary: {
      bg: "bg-primary/10 dark:bg-primary/20",
      border: "border-primary/20",
      icon: "text-primary",
      hover: "hover:bg-primary/20 dark:hover:bg-primary/30",
    },
    blue: {
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
      border: "border-blue-500/20",
      icon: "text-blue-500",
      hover: "hover:bg-blue-500/20 dark:hover:bg-blue-500/30",
    },
    green: {
      bg: "bg-green-500/10 dark:bg-green-500/20",
      border: "border-green-500/20",
      icon: "text-green-500",
      hover: "hover:bg-green-500/20 dark:hover:bg-green-500/30",
    },
    amber: {
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      border: "border-amber-500/20",
      icon: "text-amber-500",
      hover: "hover:bg-amber-500/20 dark:hover:bg-amber-500/30",
    },
    purple: {
      bg: "bg-purple-500/10 dark:bg-purple-500/20",
      border: "border-purple-500/20",
      icon: "text-purple-500",
      hover: "hover:bg-purple-500/20 dark:hover:bg-purple-500/30",
    },
    rose: {
      bg: "bg-rose-500/10 dark:bg-rose-500/20",
      border: "border-rose-500/20",
      icon: "text-rose-500",
      hover: "hover:bg-rose-500/20 dark:hover:bg-rose-500/30",
    },
  };

  const colors = colorClasses[color];

  const CardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
        type: "spring",
        stiffness: 100,
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6",
        "glass-card hover:shadow-2xl",
        "transition-all duration-500 ease-out",
        "hover:scale-105 hover:-translate-y-2",
        "cursor-pointer",
        colors.hover,
        className
      )}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center space-y-3 md:space-y-4">
        {/* Icon */}
        <div
          className={cn(
            "mx-auto w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center",
            "transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
            colors.bg,
            colors.border,
            "border shadow-lg"
          )}
        >
          <div
            className={cn(
              "h-6 w-6 md:h-8 md:w-8 flex items-center justify-center",
              colors.icon
            )}
          >
            {icon}
          </div>
        </div>

        {/* Text */}
        <div className="space-y-1 md:space-y-2">
          <h3 className="text-sm md:text-base font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
            {title}
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Shimmer Effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer" />
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}

interface PremiumQuickActionsProps {
  className?: string;
}

export function PremiumQuickActions({ className }: PremiumQuickActionsProps) {
  return (
    <div className={cn("space-y-6 md:space-y-8", className)}>
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-2"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Zap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
            Quick <span className="gradient-text-primary">Actions</span>
          </h2>
        </div>
        <p className="text-muted-foreground text-sm md:text-lg">
          What would you like to do today?
        </p>
      </motion.div>

      {/* Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
        <PremiumActionCard
          title="Explore Places"
          subtitle="Discover new spots"
          icon={<MapPin className="h-8 w-8" />}
          href="/listings"
          color="blue"
          delay={0.1}
        />

        <PremiumActionCard
          title="Find Events"
          subtitle="Book experiences"
          icon={<Calendar className="h-8 w-8" />}
          href="/events"
          color="green"
          delay={0.2}
        />

        <PremiumActionCard
          title="Write Review"
          subtitle="Share experience"
          icon={<Star className="h-8 w-8" />}
          href="/dashboard/reviews"
          color="amber"
          delay={0.3}
        />

        <PremiumActionCard
          title="My Favorites"
          subtitle="Saved places"
          icon={<Heart className="h-8 w-8" />}
          href="/dashboard/favorites"
          color="rose"
          delay={0.4}
        />

        <PremiumActionCard
          title="Achievements"
          subtitle="View badges"
          icon={<Trophy className="h-8 w-8" />}
          href="/dashboard/achievements"
          color="purple"
          delay={0.5}
        />

        <PremiumActionCard
          title="Profile"
          subtitle="Edit details"
          icon={<User className="h-8 w-8" />}
          href="/dashboard/profile"
          color="primary"
          delay={0.6}
        />
      </div>
    </div>
  );
}
