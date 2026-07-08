"use client";

import {
  Users,
  MapPin,
  Star,
  Calendar,
  TrendingUp,
  Award,
  Heart,
  Sparkles,
  Quote,
} from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";

interface PlatformStats {
  users?: number;
  listings?: number;
  reviews?: number;
  events?: number;
}

interface StatsAndSocialProofSectionProps {
  stats?: PlatformStats | null;
}

// Stats configuration defined outside component
const platformStats = [
  {
    icon: Users,
    label: "Active Users",
    defaultValue: 52000,
    suffix: "+",
    colors: {
      bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      border: "border-blue-500/30",
      icon: "text-blue-500",
      accent: "bg-blue-500",
      glow: "hover:shadow-xl hover:shadow-blue-500/25",
    },
  },
  {
    icon: MapPin,
    label: "Places Listed",
    defaultValue: 2800,
    suffix: "+",
    colors: {
      bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/30",
      icon: "text-emerald-500",
      accent: "bg-emerald-500",
      glow: "hover:shadow-xl hover:shadow-emerald-500/25",
    },
  },
  {
    icon: Star,
    label: "Reviews Written",
    defaultValue: 18500,
    suffix: "+",
    colors: {
      bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
      border: "border-amber-500/30",
      icon: "text-amber-500",
      accent: "bg-amber-500",
      glow: "hover:shadow-xl hover:shadow-amber-500/25",
    },
  },
  {
    icon: Calendar,
    label: "Events Hosted",
    defaultValue: 1200,
    suffix: "+",
    colors: {
      bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      border: "border-purple-500/30",
      icon: "text-purple-500",
      accent: "bg-purple-500",
      glow: "hover:shadow-xl hover:shadow-purple-500/25",
    },
  },
];

const testimonials = [
  {
    name: "Sarah Ahmed",
    role: "Food Blogger",
    content:
      "Inside Karachi helped me discover hidden gems I never knew existed. The recommendations are spot-on!",
    rating: 5,
  },
  {
    name: "Hassan Ali",
    role: "Local Explorer",
    content:
      "Best platform for finding authentic Karachi experiences. The community reviews are incredibly helpful.",
    rating: 5,
  },
  {
    name: "Fatima Khan",
    role: "Event Organizer",
    content:
      "Amazing platform for promoting events. The reach and engagement we get is phenomenal.",
    rating: 5,
  },
];

const testimonialColors = [
  {
    bg: "from-primary/20 via-primary/10 to-primary/5",
    border: "border-primary/30",
    accent: "bg-primary",
    glow: "hover:shadow-xl hover:shadow-primary/25",
  },
  {
    bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
    border: "border-blue-500/30",
    accent: "bg-blue-500",
    glow: "hover:shadow-xl hover:shadow-blue-500/25",
  },
  {
    bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/30",
    accent: "bg-emerald-500",
    glow: "hover:shadow-xl hover:shadow-emerald-500/25",
  },
];

export function StatsAndSocialProofSection({
  stats,
}: StatsAndSocialProofSectionProps) {
  return (
    <section className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />

      {/* Floating Background Elements */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header - CSS animation */}
        <div className="mb-16 animate-hero-fade-in">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Trusted by{" "}
                <span className="gradient-text-primary">Thousands</span>
              </h2>
            </div>
            <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
              Join a thriving community of explorers, food lovers, and culture
              enthusiasts discovering Karachi together.
            </p>
          </div>
        </div>

        {/* Stats Grid - CSS animations with stagger */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-16 sm:mb-20">
          {platformStats.map((stat, index) => {
            const value =
              index === 0
                ? stats?.users || stat.defaultValue
                : index === 1
                  ? stats?.listings || stat.defaultValue
                  : index === 2
                    ? stats?.reviews || stat.defaultValue
                    : stats?.events || stat.defaultValue;

            return (
              <div
                key={stat.label}
                className="opacity-0 animate-hero-fade-in group"
                style={{ animationDelay: `${0.1 + index * 0.1}s` }}
              >
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl p-4 sm:p-6 cursor-pointer",
                    "backdrop-blur-xl border transition-all duration-500",
                    "hover:scale-[1.02] hover:-translate-y-1",
                    `bg-gradient-to-br ${stat.colors.bg}`,
                    stat.colors.border,
                    stat.colors.glow,
                    "transform-gpu",
                  )}
                >
                  {/* Border glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div
                      className={cn(
                        "absolute inset-0 rounded-2xl opacity-30 blur-md",
                        stat.colors.accent,
                      )}
                    />
                    <div
                      className={cn(
                        "absolute inset-0 rounded-2xl opacity-10 blur-lg",
                        stat.colors.accent,
                      )}
                    />
                  </div>

                  {/* Animated accent line */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
                      stat.colors.accent,
                    )}
                  />

                  <div className="relative z-10">
                    {/* Icon container */}
                    <div className="flex justify-center mb-3 sm:mb-4 md:mb-6">
                      <div
                        className={cn(
                          "relative p-2 rounded-xl transition-all duration-500",
                          "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                          `bg-gradient-to-br ${stat.colors.bg}`,
                          "border border-white/20 dark:border-white/10",
                          "shadow-lg group-hover:shadow-xl",
                        )}
                      >
                        <div
                          className={cn(
                            "h-5 w-5 sm:h-6 sm:w-6",
                            stat.colors.icon,
                          )}
                        >
                          <stat.icon className="h-full w-full" />
                        </div>
                      </div>
                    </div>

                    {/* Stats content */}
                    <div className="text-center space-y-1 sm:space-y-2">
                      <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                        <AnimatedCounter
                          value={value}
                          duration={2000}
                          suffix={stat.suffix}
                        />
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Testimonials Section - CSS animation */}
        <div
          className="space-y-8 sm:space-y-12 opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "0.4s" }}
        >
          {/* Testimonials Header */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <Quote className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                What People Say
              </h3>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              Real experiences from our community members
            </p>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((testimonial, index) => {
              const colors =
                testimonialColors[index % testimonialColors.length];

              return (
                <div
                  key={index}
                  className="opacity-0 animate-hero-fade-in group"
                  style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                >
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-2xl p-4 sm:p-6 cursor-pointer",
                      "backdrop-blur-xl border transition-all duration-500",
                      "hover:scale-[1.02] hover:-translate-y-1",
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
                          "absolute inset-0 rounded-2xl opacity-30 blur-md",
                          colors.accent,
                        )}
                      />
                      <div
                        className={cn(
                          "absolute inset-0 rounded-2xl opacity-10 blur-lg",
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

                    {/* Quote Icon */}
                    <div className="relative z-10 mb-4">
                      <div
                        className={cn(
                          "inline-flex p-2 rounded-lg transition-all duration-500",
                          "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                          `bg-gradient-to-br ${colors.bg}`,
                          "border border-white/20 dark:border-white/10",
                          "shadow-lg group-hover:shadow-xl",
                        )}
                      >
                        <Quote className="h-4 w-4 text-primary" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 space-y-4">
                      {/* Rating */}
                      <div className="flex space-x-1">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star
                            key={i}
                            className="h-4 w-4 text-yellow-500 fill-current"
                          />
                        ))}
                      </div>

                      {/* Testimonial Text */}
                      <p className="text-muted-foreground leading-relaxed">
                        &ldquo;{testimonial.content}&rdquo;
                      </p>

                      {/* Author */}
                      <div className="pt-4 border-t border-border/50">
                        <div className="font-semibold text-foreground">
                          {testimonial.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {testimonial.role}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust Indicators - CSS animation */}
        <div
          className="mt-16 text-center opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "0.8s" }}
        >
          <div className="flex items-center justify-center space-x-4 sm:space-x-8 text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Award className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Verified Reviews</span>
            </div>
            <div className="flex items-center space-x-2">
              <Heart className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Community Driven</span>
            </div>
            <div className="flex items-center space-x-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Premium Quality</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
