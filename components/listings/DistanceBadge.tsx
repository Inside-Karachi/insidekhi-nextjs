"use client";

import { MapPin } from "lucide-react";

interface DistanceBadgeProps {
  distanceMeters: number;
  className?: string;
  compact?: boolean;
}

/**
 * Displays distance from user in a compact format
 * Optimized for both light and dark modes
 */
export function DistanceBadge({
  distanceMeters,
  className = "",
  compact = false,
}: DistanceBadgeProps) {
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }

    const km = meters / 1000;
    if (km < 10) {
      return `${km.toFixed(1)}km`;
    }

    return `${Math.round(km)}km`;
  };

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/90 dark:bg-primary/95 backdrop-blur-sm text-primary-foreground text-xs font-semibold shadow-lg ring-1 ring-primary/20 ${className}`}
      >
        <MapPin className="h-3.5 w-3.5" />
        <span>{formatDistance(distanceMeters)}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/95 dark:bg-primary/98 backdrop-blur-md border border-primary-foreground/10 text-primary-foreground text-sm font-bold shadow-xl ${className}`}
    >
      <MapPin className="h-4 w-4" />
      <span>{formatDistance(distanceMeters)}</span>
    </div>
  );
}
