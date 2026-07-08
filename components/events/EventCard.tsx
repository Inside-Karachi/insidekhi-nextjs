"use client";

import { motion } from "framer-motion";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MapPin, Crown, Ticket, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Event } from "@/types/events.types";

interface EventCardProps {
  event: Event;
  index?: number;
  showAnimation?: boolean;
  variant?: "default" | "featured" | "compact";
}

// Category color schemes for events
const categoryColorSchemes: Record<
  string,
  {
    bg: string;
    border: string;
    glow: string;
    accent: string;
    icon: string;
  }
> = {
  food: {
    bg: "bg-orange-100 dark:bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-500/20",
    glow: "hover:shadow-lg hover:shadow-orange-500/10",
    accent: "bg-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
  },
  tech: {
    bg: "bg-blue-100 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    glow: "hover:shadow-lg hover:shadow-blue-500/10",
    accent: "bg-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
  },
  art: {
    bg: "bg-purple-100 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    glow: "hover:shadow-lg hover:shadow-purple-500/10",
    accent: "bg-purple-500",
    icon: "text-purple-600 dark:text-purple-400",
  },
  music: {
    bg: "bg-violet-100 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/20",
    glow: "hover:shadow-lg hover:shadow-violet-500/10",
    accent: "bg-violet-500",
    icon: "text-violet-600 dark:text-violet-400",
  },
  business: {
    bg: "bg-emerald-100 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    glow: "hover:shadow-lg hover:shadow-emerald-500/10",
    accent: "bg-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  sports: {
    bg: "bg-red-100 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/20",
    glow: "hover:shadow-lg hover:shadow-red-500/10",
    accent: "bg-red-500",
    icon: "text-red-600 dark:text-red-400",
  },
  health: {
    bg: "bg-green-100 dark:bg-green-500/10",
    border: "border-green-200 dark:border-green-500/20",
    glow: "hover:shadow-lg hover:shadow-green-500/10",
    accent: "bg-green-500",
    icon: "text-green-600 dark:text-green-400",
  },
  default: {
    bg: "bg-slate-100 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-500/20",
    glow: "hover:shadow-lg hover:shadow-slate-500/10",
    accent: "bg-slate-500",
    icon: "text-slate-600 dark:text-slate-400",
  },
};

export function EventCard({
  event,
  showAnimation = true,
  variant = "default",
}: EventCardProps) {
  const formatEventDate = (startTime: string) => {
    const date = new Date(startTime);
    return {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      day: date.getDate(),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      full: date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  };

  const getEventStatus = (startTime: string, endTime?: string) => {
    const now = new Date();
    const eventStart = new Date(startTime);
    const eventEnd = endTime ? new Date(endTime) : null;

    // If endTime exists and now is between start & end, it's ongoing
    if (eventEnd && now >= eventStart && now <= eventEnd)
      return { text: "Ongoing", variant: "success" as const };

    const hoursUntilEvent =
      (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent < 0)
      return { text: "Past Event", variant: "secondary" as const };
    if (hoursUntilEvent < 24)
      return { text: "Today", variant: "destructive" as const };
    if (hoursUntilEvent < 168)
      return { text: "This Week", variant: "default" as const };

    return { text: "Upcoming", variant: "outline" as const };
  };

  const getEventCategory = () => {
    const name = event.name?.toLowerCase() || "";
    if (name.includes("food") || name.includes("festival")) return "food";
    if (
      name.includes("tech") ||
      name.includes("meetup") ||
      name.includes("startup")
    )
      return "tech";
    if (name.includes("art") || name.includes("culture")) return "art";
    if (name.includes("music") || name.includes("concert")) return "music";
    if (name.includes("business") || name.includes("networking"))
      return "business";
    if (name.includes("gaming") || name.includes("tournament")) return "sports";
    if (name.includes("health") || name.includes("wellness")) return "health";
    return "default";
  };

  const eventDate = formatEventDate(event.start_time);
  const eventStatus = getEventStatus(event.start_time, event.end_time);
  const categoryKey = getEventCategory();
  const categoryColors = categoryColorSchemes[categoryKey];

  const getEventImage = () => {
    if (event.images && event.images.length > 0) {
      return (
        event.images.find((img) => img.is_primary)?.url || event.images[0].url
      );
    }

    const categoryImages = {
      food: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
      tech: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
      art: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
      music:
        "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
      business:
        "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
      sports:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
      health:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
      default:
        "https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
    };

    const categoryKey = getEventCategory();
    return (
      categoryImages[categoryKey as keyof typeof categoryImages] ||
      categoryImages.default
    );
  };

  return (
    <motion.div
      initial={showAnimation ? { opacity: 0, y: 15, scale: 0.97 } : undefined}
      animate={showAnimation ? { opacity: 1, y: 0, scale: 1 } : undefined}
      whileHover={{
        scale: 1.02,
        y: -6,
        transition: { duration: 0.25, ease: "easeOut" },
      }}
      className="group"
    >
      <div className="block group">
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform-gpu group-hover:scale-[1.02]">
          {/* Glow */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
              categoryColors.glow,
            )}
          />

          {/* Image Container */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-muted/50 dark:bg-zinc-800/50">
            {/* Status Badge */}
            <div className="absolute left-3 top-3 z-20">
              <div
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm",
                  eventStatus.variant === "destructive"
                    ? "bg-red-500 text-white"
                    : eventStatus.variant === "success"
                      ? "bg-emerald-500 text-white"
                      : eventStatus.variant === "default"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-500 text-white",
                )}
              >
                <div className="flex items-center space-x-1">
                  <Ticket className="h-3 w-3" />
                  <span>{eventStatus.text}</span>
                </div>
              </div>
            </div>

            {/* Featured Badge */}
            {variant === "featured" && (
              <div className="absolute bottom-3 left-3 z-20">
                <div className="px-2.5 py-1 rounded-lg bg-yellow-500 text-yellow-900 text-xs font-bold shadow-sm">
                  <div className="flex items-center space-x-1">
                    <Crown className="h-3 w-3" />
                    <span>Featured</span>
                  </div>
                </div>
              </div>
            )}

            {/* Image */}
            <OptimizedImage
              src={getEventImage()}
              alt={`${event.name} event`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              fallbackSrc="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=400&fit=crop&crop=center&auto=format&q=80"
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>

          {/* Content Section */}
          <Link href={`/events/${event.slug}`} className="block">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "px-2 py-1 rounded-md text-xs font-medium",
                    categoryColors.bg,
                    categoryColors.icon,
                  )}
                >
                  {categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}{" "}
                  Event
                </span>

                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {eventDate.month}
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {eventDate.day}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
                  {event.name}
                </h3>

                <div className="space-y-1">
                  <div className="flex items-center space-x-1 text-muted-foreground">
                    <Ticket className="h-3.5 w-3.5" />
                    <span className="text-sm">
                      {eventDate.weekday}, {eventDate.time}
                    </span>
                  </div>

                  {event.location_name && (
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-sm line-clamp-1">
                        {event.location_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/20">
                <div className="flex items-center space-x-1 text-muted-foreground">
                  <span className="text-sm">
                    By {event.organizer_name || "Organizer"}
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary hover:text-primary/80 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-200"
                >
                  View Event
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
