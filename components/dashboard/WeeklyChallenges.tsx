"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Target, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveChallenge } from "@/types/gamification.types";

interface WeeklyChallengesProps {
  className?: string;
}

export function WeeklyChallenges({ className }: WeeklyChallengesProps) {
  const [challenges, setChallenges] = React.useState<ActiveChallenge[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchChallenges = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/gamification/challenges");

        if (response.ok) {
          const data = await response.json();
          setChallenges(data.challenges || []);
        }
      } catch (error) {
        console.error("Error fetching challenges:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted rounded-xl animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-muted rounded w-48 animate-pulse" />
            <div className="h-3 bg-muted rounded w-32 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 bg-muted/30 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No Active Challenges
        </h3>
        <p className="text-sm text-muted-foreground">
          Check back soon for new weekly challenges!
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-bold text-foreground">
            Weekly Challenges
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            {challenges.length}{" "}
            {challenges.length === 1 ? "challenge" : "challenges"} active
          </p>
        </div>
      </div>

      {/* Challenges List */}
      <div className="space-y-3">
        {challenges.map((challenge, index) => {
          const progressPercent = Math.min(
            (challenge.current_progress / challenge.target_count) * 100,
            100
          );
          const isCompleted = challenge.is_completed;

          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300",
                isCompleted
                  ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800"
                  : "bg-card hover:shadow-md border-border"
              )}
            >
              {/* Background Pattern */}
              {!isCompleted && (
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full blur-3xl" />
                </div>
              )}

              <div className="relative space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm md:text-base font-semibold text-foreground mb-1 line-clamp-1">
                      {challenge.title}
                    </h4>
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                      {challenge.description}
                    </p>
                  </div>

                  {isCompleted && (
                    <div className="flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">
                      Progress: {challenge.current_progress}/
                      {challenge.target_count}
                    </span>
                    <span className="font-semibold text-primary">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        isCompleted
                          ? "bg-gradient-to-r from-green-500 to-emerald-500"
                          : "bg-gradient-to-r from-primary to-primary/80"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Footer Row */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {challenge.days_remaining === 0
                        ? "Ends today"
                        : challenge.days_remaining === 1
                          ? "1 day left"
                          : `${challenge.days_remaining} days left`}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs md:text-sm",
                      isCompleted
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    <span>+{challenge.xp_reward} XP</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
