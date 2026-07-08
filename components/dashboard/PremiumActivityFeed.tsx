"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Star,
  Calendar,
  Clock,
  MapPin,
  Heart,
  Award,
  Zap,
  Activity,
} from "lucide-react";

export interface ActivityItem {
  type: "points" | "review" | "booking" | "favorite" | "achievement";
  content: string;
  time: string;
  points?: number;
  rating?: number;
  amount?: number;
  location?: string;
}

interface ActivityItemProps {
  activity: ActivityItem;
  index: number;
  isLast: boolean;
}

function PremiumActivityItem({ activity, index, isLast }: ActivityItemProps) {
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
          "group-hover:scale-110 group-hover:shadow-lg",
          config.bg,
          config.border,
          config.color
        )}
      >
        {config.icon}
      </div>

      {/* Activity content */}
      <div className="flex-1 min-w-0">
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
          className="glass-card p-4 group-hover:shadow-lg transition-all duration-300"
        >
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
        </motion.div>
      </div>
    </motion.div>
  );
}

interface PremiumActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

export function PremiumActivityFeed({
  activities,
  className,
}: PremiumActivityFeedProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-2"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
            Recent <span className="gradient-text-primary">Activity</span>
          </h2>
        </div>
        <p className="text-muted-foreground">
          Your latest interactions with Inside Karachi
        </p>
      </motion.div>

      {/* Activity Feed */}
      <div className="space-y-4">
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
              Start exploring Karachi to see your activity timeline here! Visit
              places, write reviews, and book events.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
