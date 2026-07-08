"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import HeroSection from "@/components/ui/HeroSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Calendar,
  ArrowRight,
  Sparkles,
  Users,
  Building,
  Ticket,
} from "lucide-react";

interface EventsHeroProps {
  totalEvents: number;
}

export function EventsHero({ totalEvents }: EventsHeroProps) {
  // Stats matching other pages
  const stats = [
    {
      icon: Calendar,
      label: "Upcoming Events",
      value: `${totalEvents}+`,
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      icon: Users,
      label: "Event Organizers",
      value: "50+",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
    {
      icon: Building,
      label: "Event Venues",
      value: "100+",
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-500",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
  ];

  return (
    <HeroSection
      floating={
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="absolute top-16 sm:top-20 left-4 sm:left-20"
          >
            <motion.div
              animate={{ y: [0, -18, 0], rotate: [0, 6, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
              className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
            >
              <Ticket className="h-4 w-4 sm:h-6 sm:w-6 text-amber-400" />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="absolute top-24 sm:top-32 right-4 sm:right-32"
          >
            <motion.div
              animate={{ y: [0, 14, 0], rotate: [0, -6, 0] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-background/20 backdrop-blur-xl border border-border/30"
            >
              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </motion.div>
          </motion.div>
        </>
      }
    >
      <div className="container mx-auto px-6 lg:px-8 text-center space-y-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, duration: 0.35 }}
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Sparkles className="w-4 h-4 mr-2" />
            {totalEvents} Upcoming Events
          </Badge>
        </motion.div>

        {/* Main Heading */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="space-y-4 max-w-4xl mx-auto"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
            Discover Amazing{" "}
            <span className="gradient-text-primary">Events</span>
            <br />
            in Karachi
          </h1>

          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
            From cultural festivals to tech meetups, comedy shows to food events
            - find your next unforgettable experience in the heart of Pakistan.
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            size="lg"
            onClick={() => {
              const el = document.getElementById("events-list");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Calendar className="w-5 h-5 mr-2" />
            Find Events
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10 px-8 py-4 rounded-xl font-semibold"
            asChild
          >
            <Link href="/contact">
              <Users className="w-5 h-5 mr-2" />
              Host an Event
            </Link>
          </Button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto pt-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{
                scale: 1.02,
                y: -4,
                transition: { duration: 0.2, ease: "easeOut" },
              }}
              transition={{ delay: 0.25 + index * 0.05, duration: 0.35 }}
              className="group"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 group cursor-pointer",
                  "backdrop-blur-xl border transition-all duration-500",
                  `bg-gradient-to-br ${stat.colors.bg}`,
                  stat.colors.border,
                  stat.colors.glow,
                  "transform-gpu"
                )}
              >
                {/* Border glow (matches MembershipHero) */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-30 blur-md",
                      stat.colors.accent
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-10 blur-lg",
                      stat.colors.accent
                    )}
                  />
                </div>

                {/* Animated accent line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out",
                    stat.colors.accent
                  )}
                />

                <div className="relative z-10">
                  <div className="flex flex-col items-center space-y-3">
                    <div
                      className={cn(
                        "relative p-2 md:p-3 rounded-xl transition-all duration-500",
                        "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                        `bg-gradient-to-br ${stat.colors.bg}`,
                        "border border-white/20 dark:border-white/10",
                        "shadow-lg group-hover:shadow-xl"
                      )}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 md:h-6 md:w-6",
                          stat.colors.icon
                        )}
                      >
                        <stat.icon className="h-full w-full" />
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Featured events preview removed from hero to place it above the events list */}
      </div>
    </HeroSection>
  );
}
