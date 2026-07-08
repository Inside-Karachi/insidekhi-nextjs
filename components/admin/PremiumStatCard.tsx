"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "emerald" | "indigo" | "pink";
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  className?: string;
  delay?: number;
}

const colorVariants = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800/30",
    icon: "text-blue-600 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800/30",
    icon: "text-green-600 dark:text-green-400",
    value: "text-green-700 dark:text-green-300",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800/30",
    icon: "text-purple-600 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800/30",
    icon: "text-orange-600 dark:text-orange-400",
    value: "text-orange-700 dark:text-orange-300",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800/30",
    icon: "text-red-600 dark:text-red-400",
    value: "text-red-700 dark:text-red-300",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800/30",
    icon: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    border: "border-indigo-200 dark:border-indigo-800/30",
    icon: "text-indigo-600 dark:text-indigo-400",
    value: "text-indigo-700 dark:text-indigo-300",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-900/20",
    border: "border-pink-200 dark:border-pink-800/30",
    icon: "text-pink-600 dark:text-pink-400",
    value: "text-pink-700 dark:text-pink-300",
  },
};

export function PremiumStatCard({
  title,
  value,
  icon: Icon,
  color = "blue",
  trend,
  className,
  delay = 0,
}: PremiumStatCardProps) {
  const colors = colorVariants[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: delay * 0.1,
        ease: "easeOut"
      }}
      className={cn(
        "group relative overflow-hidden",
        "bg-card/50 backdrop-blur-sm border border-border/50",
        "rounded-xl p-6 shadow-sm",
        "hover:shadow-lg hover:border-primary/30",
        "transition-all duration-300 hover:scale-[1.02]",
        className
      )}
    >
      {/* Background gradient overlay */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        colors.bg
      )} />

      {/* Content */}
      <div className="relative flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              "p-2 rounded-lg transition-colors duration-300",
              colors.bg,
              "group-hover:scale-110"
            )}>
              <Icon className={cn("h-5 w-5", colors.icon)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
                {title}
              </h3>
              {trend && (
                <div className={cn(
                  "text-xs font-medium flex items-center gap-1 mt-1",
                  trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  <span>{trend.isPositive ? "+" : ""}{trend.value}%</span>
                  <span className="text-muted-foreground">({trend.label})</span>
                </div>
              )}
            </div>
          </div>

          <div className={cn(
            "text-3xl font-bold transition-colors duration-300",
            colors.value
          )}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        </div>

        {/* Decorative element */}
        <div className="hidden sm:block">
          <div className={cn(
            "w-16 h-16 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300",
            colors.bg
          )} />
        </div>
      </div>

      {/* Subtle bottom border */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-1 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        colors.bg
      )} />
    </motion.div>
  );
}