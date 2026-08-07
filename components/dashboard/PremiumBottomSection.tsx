"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatEventDate } from "@/lib/utils/date-utils";
import Link from "next/link";
import {
  MapPin,
  Star,
  Calendar,
  Clock,
  Trophy,
  Heart,
  Award,
  Zap,
  Activity,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// Activity interfaces
interface ActivityItem {
  type: "points" | "review" | "booking" | "favorite" | "achievement";
  content: string;
  time: string;
  points?: number;
  rating?: number;
  amount?: number;
  location?: string;
}

// Recommendation interfaces
interface Recommendation {
  id: number;
  name: string;
  address: string;
  slug: string;
  rating?: number;
  category?: string;
  distanceKm?: number;
  reason?: string;
}

interface UpcomingEvent {
  id: number;
  name: string;
  slug: string;
  start_time: string;
}

interface PremiumBottomSectionProps {
  recommendations: Recommendation[];
  activities: ActivityItem[];
  upcomingEvents?: UpcomingEvent[];
  className?: string;
}

// Activity Item Component
function PremiumActivityItem({
  activity,
  index,
  isLast,
}: {
  activity: ActivityItem;
  index: number;
  isLast: boolean;
}) {
  const getActivityConfig = (type: ActivityItem["type"]) => {
    switch (type) {
      case "points":
        return {
          icon: <Trophy className="h-5 w-5" />,
          color: "text-amber-500",
          bg: "bg-amber-500/10 dark:bg-amber-500/20",
          border: "border-amber-500/20",
        };
      case "review":
        return {
          icon: <Star className="h-5 w-5" />,
          color: "text-blue-500",
          bg: "bg-blue-500/10 dark:bg-blue-500/20",
          border: "border-blue-500/20",
        };
      case "booking":
        return {
          icon: <Calendar className="h-5 w-5" />,
          color: "text-green-500",
          bg: "bg-green-500/10 dark:bg-green-500/20",
          border: "border-green-500/20",
        };
      case "favorite":
        return {
          icon: <Heart className="h-5 w-5" />,
          color: "text-rose-500",
          bg: "bg-rose-500/10 dark:bg-rose-500/20",
          border: "border-rose-500/20",
        };
      case "achievement":
        return {
          icon: <Award className="h-5 w-5" />,
          color: "text-purple-500",
          bg: "bg-purple-500/10 dark:bg-purple-500/20",
          border: "border-purple-500/20",
        };
      default:
        return {
          icon: <Zap className="h-5 w-5" />,
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
        {config.icon}
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

                  {activity.rating && (
                    <span className="flex items-center space-x-1">
                      <Star className="h-3 w-3 text-amber-500 fill-current" />
                      <span>{activity.rating}/5</span>
                    </span>
                  )}

                  {activity.location && (
                    <span className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-32">
                        {activity.location}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Points badge */}
              {activity.points && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: index * 0.1 + 0.3,
                    type: "spring",
                    stiffness: 200,
                  }}
                  className="ml-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20"
                >
                  <span className="text-sm font-semibold text-primary">
                    +{activity.points} XP
                  </span>
                </motion.div>
              )}

              {/* Amount badge */}
              {activity.amount && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: index * 0.1 + 0.3,
                    type: "spring",
                    stiffness: 200,
                  }}
                  className="ml-4 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20"
                >
                  <span className="text-sm font-semibold text-green-600">
                    Rs. {activity.amount}
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Recommendation Card Component
function RecommendationCard({
  title,
  subtitle,
  rating,
  category,
  distanceKm,
  reason,
  href,
  delay = 0,
}: {
  title: string;
  subtitle: string;
  rating?: number;
  category?: string;
  distanceKm?: number;
  reason?: string;
  href: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.3, ease: "easeOut" },
      }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <Link href={href}>
        <div className="relative overflow-hidden rounded-2xl p-6 group cursor-pointer border border-border/30 bg-gradient-to-br from-background/40 via-background/20 to-transparent hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          {/* Subtle hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Refined accent line */}
          <div className="absolute top-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 ease-out bg-gradient-to-r from-primary/60 to-primary/30" />

          <div className="relative z-10">
            <div className="flex items-start space-x-4">
              <div className="relative p-3 rounded-xl bg-gradient-to-br from-primary/15 via-primary/8 to-primary/3 border border-primary/15 group-hover:scale-105 transition-all duration-300 shadow-sm">
                <MapPin className="h-5 w-5 text-primary" />
                {/* Subtle icon glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 bg-primary/10 blur-sm" />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors duration-300 truncate">
                  {title}
                </h4>
                <p className="text-sm text-muted-foreground truncate">
                  {subtitle}
                </p>
                <div className="flex items-center flex-wrap gap-2">
                  {rating && (
                    <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/20">
                      <Star className="h-3 w-3 text-amber-500 fill-current" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {Number(rating).toFixed(1)}
                      </span>
                    </div>
                  )}
                  {category && (
                    <div className="px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="text-xs font-medium text-primary">
                        {category}
                      </span>
                    </div>
                  )}
                  {typeof distanceKm === "number" && (
                    <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-muted/60 border border-border/40">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {distanceKm < 1
                          ? `${Math.round(distanceKm * 1000)}m away`
                          : `${distanceKm.toFixed(1)}km away`}
                      </span>
                    </div>
                  )}
                </div>
                {reason && (
                  <p className="text-xs text-primary/80 font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {reason}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/8 group-hover:bg-primary/15 transition-all duration-300">
                <ArrowRight className="h-4 w-4 text-primary/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
              </div>
            </div>
          </div>

          {/* Subtle shine effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 dark:via-white/3 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-800 ease-out" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PremiumBottomSection({
  recommendations,
  activities,
  upcomingEvents,
  className,
}: PremiumBottomSectionProps) {
  return (
    <div className={cn("space-y-6 md:space-y-8", className)}>
      {/* Two-Column Layout with Visual Separation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-8 lg:items-start">
        {/* Left Column - Curated for You */}
        <div className="space-y-6">
          {/* Section Header - Outside Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Curated for <span className="gradient-text-primary">You</span>
              </h2>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground">
              Personalized picks based on your interests and location
            </p>
          </motion.div>

          {/* Content Container */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            className="relative overflow-hidden rounded-3xl backdrop-blur-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/60 to-primary/5 p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-500 h-full"
          >
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-60" />

            {/* Animated accent border */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-t-3xl" />

            <div className="relative z-10 space-y-6">
              {recommendations.length > 0 ? (
                recommendations.map((place, index) => (
                  <RecommendationCard
                    key={place.id}
                    title={place.name}
                    subtitle={place.address}
                    rating={place.rating}
                    category={place.category}
                    distanceKm={place.distanceKm}
                    reason={place.reason}
                    href={`/listing/${place.slug}`}
                    delay={0.1 + index * 0.1}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  className="text-center py-6"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted/50 flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No recommendations yet
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    Start exploring Karachi to get personalized recommendations!
                    Visit places and add them to favorites.
                  </p>
                </motion.div>
              )}

              {/* Upcoming Events */}
              {upcomingEvents && upcomingEvents.length > 0 && (
                <div className="border-t border-border pt-6 md:pt-8 mt-6 md:mt-8">
                  <div className="flex items-center space-x-2 mb-4 md:mb-6">
                    <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <h3 className="text-base md:text-lg font-semibold text-foreground">
                      Upcoming Events
                    </h3>
                  </div>
                  <div className="space-y-4">
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
                                  {formatEventDate(event.start_time).date}
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
          </motion.div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="space-y-6 mt-[8rem] lg:mt-0">
          {/* Section Header - Outside Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Recent <span className="gradient-text-primary">Activity</span>
              </h2>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground">
              Your latest interactions with Inside Karachi
            </p>
          </motion.div>

          {/* Content Container */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            className="relative overflow-hidden rounded-3xl backdrop-blur-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/60 to-red-500/5 p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-500 h-full"
          >
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/10 opacity-60" />

            {/* Animated accent border */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-red-500/80 to-red-500/60 rounded-t-3xl" />

            <div className="relative z-10 space-y-4">
              {activities.length > 0 ? (
                activities.map((activity, index) => (
                  <PremiumActivityItem
                    key={index}
                    activity={activity}
                    index={index}
                    isLast={index === activities.length - 1}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  className="text-center py-6"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted/50 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No activity yet
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    Start exploring Karachi to see your activity timeline here!
                    Visit places, write reviews, and book events.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
