"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation } from "lucide-react";
import { EventLocationProps } from "@/types/events.types";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

export function EventLocation({ event }: EventLocationProps) {
  const locationName = event.location_name;
  const locationAddress = event.address;
  const locationLatitude = event.latitude;
  const locationLongitude = event.longitude;

  if (!locationName && !locationAddress) {
    return null;
  }

  const handleGetDirections = () => {
    if (locationLatitude && locationLongitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${locationLatitude},${locationLongitude}`;
      window.open(url, "_blank");
    } else if (locationAddress) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        locationAddress,
      )}`;
      window.open(url, "_blank");
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Section eyebrow */}
      <p className="mb-3 text-xs font-mono font-semibold uppercase tracking-wider text-primary">
        Location
      </p>

      {/* Location Card */}
      <Card className="overflow-hidden rounded-2xl border-2 border-border p-0">
        {/* Map Area (stylized, non-interactive preview) */}
        <button
          type="button"
          onClick={handleGetDirections}
          aria-label={`Open directions to ${locationName || "venue"}`}
          className="group relative block h-40 md:h-56 w-full bg-[#161618] cursor-pointer"
        >
          <svg
            viewBox="0 0 284 120"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <rect width="284" height="120" fill="#161618" />
            <path
              d="M0 90 Q 80 60 150 75 T 284 55"
              stroke="#2c2c30"
              strokeWidth="10"
              fill="none"
            />
            <path
              d="M40 0 L 90 120"
              stroke="#232326"
              strokeWidth="6"
              fill="none"
            />
            <path
              d="M200 0 L 170 120"
              stroke="#232326"
              strokeWidth="5"
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="30"
              height="34"
              viewBox="0 0 30 34"
              className="drop-shadow-md transition-transform group-hover:-translate-y-0.5"
            >
              <path
                d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 19 15 19s15-8.5 15-19C30 6.7 23.3 0 15 0z"
                fill="hsl(var(--primary))"
              />
              <circle cx="15" cy="15" r="6" fill="#161618" />
            </svg>
          </div>
        </button>

        {/* Info bar */}
        <div className="flex items-center gap-3 border-t-2 border-border p-4">
          <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {locationName && (
              <h3 className="text-sm md:text-base font-semibold truncate">
                {locationName}
              </h3>
            )}
            {locationAddress && (
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                {locationAddress}
              </p>
            )}
          </div>
          <Button
            className="flex-shrink-0 rounded-full border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            size="sm"
            onClick={handleGetDirections}
          >
            <Navigation className="w-4 h-4 mr-1.5" />
            Directions
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
