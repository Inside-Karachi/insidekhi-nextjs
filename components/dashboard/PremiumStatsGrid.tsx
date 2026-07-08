"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import {
  Star,
  Calendar,
  Heart,
  Award,
  TrendingUp,
  TrendingDown
} from "lucide-react"

interface StatCardProps {
  title: string
  value: number
  subtitle: string
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  color: 'primary' | 'blue' | 'green' | 'amber' | 'rose' | 'purple'
  delay?: number
  className?: string
}

function PremiumStatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  color, 
  delay = 0,
  className 
}: StatCardProps) {
  const colorClasses = {
    primary: {
      bg: 'bg-primary/10 dark:bg-primary/20',
      border: 'border-primary/20',
      icon: 'text-primary',
      accent: 'text-primary'
    },
    blue: {
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
      border: 'border-blue-500/20',
      icon: 'text-blue-500',
      accent: 'text-blue-500'
    },
    green: {
      bg: 'bg-green-500/10 dark:bg-green-500/20',
      border: 'border-green-500/20',
      icon: 'text-green-500',
      accent: 'text-green-500'
    },
    amber: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      border: 'border-amber-500/20',
      icon: 'text-amber-500',
      accent: 'text-amber-500'
    },
    rose: {
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      border: 'border-rose-500/20',
      icon: 'text-rose-500',
      accent: 'text-rose-500'
    },
    purple: {
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
      border: 'border-purple-500/20',
      icon: 'text-purple-500',
      accent: 'text-purple-500'
    }
  }

  const colors = colorClasses[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay, 
        duration: 0.6, 
        ease: [0.4, 0, 0.2, 1],
        type: "spring",
        stiffness: 100
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6",
        "glass-card hover:shadow-2xl",
        "transition-all duration-500 ease-out",
        "hover:scale-105 hover:-translate-y-2",
        "cursor-pointer",
        className
      )}
    >
      {/* Background Gradient */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        colors.bg
      )} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300",
            colors.bg,
            colors.border,
            "border group-hover:scale-110"
          )}>
            <div className={cn("h-6 w-6", colors.icon)}>
              {icon}
            </div>
          </div>
          
          {trend && (
            <div className={cn(
              "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
              trend.isPositive 
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-2">
          <AnimatedCounter
            value={value}
            className="text-3xl font-bold text-foreground group-hover:scale-110 transition-transform duration-300"
            duration={2}
          />
        </div>

        {/* Title and Subtitle */}
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Hover Effect Overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl" />
        <div className="absolute bottom-4 left-4 w-12 h-12 bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-lg" />
      </div>
    </motion.div>
  )
}

interface PremiumStatsGridProps {
  stats: {
    reviews: number
    bookings: number
    favorites: number
    achievements: number
  }
  trends?: {
    reviews?: { value: number; isPositive: boolean }
    bookings?: { value: number; isPositive: boolean }
    favorites?: { value: number; isPositive: boolean }
    achievements?: { value: number; isPositive: boolean }
  }
  className?: string
}

export function PremiumStatsGrid({ stats, trends, className }: PremiumStatsGridProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", className)}>
      <PremiumStatCard
        title="Reviews Written"
        value={stats.reviews}
        subtitle="Sharing experiences"
        icon={<Star className="h-6 w-6" />}
        color="blue"
        trend={trends?.reviews}
        delay={0.1}
      />

      <PremiumStatCard
        title="Events Booked"
        value={stats.bookings}
        subtitle="Adventures planned"
        icon={<Calendar className="h-6 w-6" />}
        color="green"
        trend={trends?.bookings}
        delay={0.2}
      />

      <PremiumStatCard
        title="Saved Places"
        value={stats.favorites}
        subtitle="Personal collection"
        icon={<Heart className="h-6 w-6" />}
        color="rose"
        trend={trends?.favorites}
        delay={0.3}
      />

      <PremiumStatCard
        title="Achievements"
        value={stats.achievements}
        subtitle="Badges earned"
        icon={<Award className="h-6 w-6" />}
        color="amber"
        trend={trends?.achievements}
        delay={0.4}
      />
    </div>
  )
}
