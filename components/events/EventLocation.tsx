"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, Share2 } from "lucide-react";
import Link from "next/link";
import { PremiumHeading } from "@/components/brand/Typography";
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

  // Build marker-enabled embed URL (no API key) for the event location
  const hasCoords = Boolean(locationLatitude && locationLongitude);
  const embedUrl = hasCoords
    ? `https://www.google.com/maps?q=loc:${locationLatitude},${locationLongitude}&z=16&output=embed`
    : locationAddress
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          locationAddress!,
        )}&z=16&output=embed`
      : undefined;

  const handleShareLocation = async () => {
    if (navigator.share && locationAddress) {
      try {
        await navigator.share({
          title: `${event.name} - Event Location`,
          text: `Join us at ${locationName || "the venue"} for ${event.name}`,
          url: window.location.href,
        });
      } catch {
        // Fallback to copying to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(
            `${locationName || "Venue"}\n${locationAddress}`,
          );
        }
      }
    }
  };

  return (
    <motion.div
      className="space-y-6 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Section Header */}
      <div className="flex items-center space-x-4">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full">
          <MapPin className="w-6 h-6 text-primary" />
        </div>
        <div>
          <PremiumHeading level={2} dense className="text-foreground">
            Event <span className="gradient-text-primary">Location</span>
          </PremiumHeading>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
            Find your way to the venue and plan your visit.
          </p>
        </div>
      </div>

      {/* Location Card */}
      <div>
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl">
          {/* Map Area */}
          <div className="relative h-64 md:h-80 bg-gradient-to-br from-primary/10 to-primary/5">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                className="absolute inset-0 w-full h-full"
                title={`Map showing location of ${locationName || event.name}`}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Map unavailable</p>
                </div>
              </div>
            )}

            {/* Map overlay with quick actions */}
            <div className="absolute top-4 right-4 space-y-2 pointer-events-none">
              <Button
                variant="secondary"
                size="sm"
                className="bg-background/90 backdrop-blur-sm shadow-lg hover:bg-background pointer-events-auto"
                onClick={handleGetDirections}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Directions
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="bg-background/90 backdrop-blur-sm shadow-lg hover:bg-background pointer-events-auto"
                onClick={handleShareLocation}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Location Info overlay - move away from Google controls and make non-interactive */}
          {(locationName || locationAddress) && (
            <div className="absolute top-4 left-4 max-w-md pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-2xl p-3 md:p-4 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-md">
                    <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {locationName && (
                      <h3 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">
                        {locationName}
                      </h3>
                    )}
                    {locationAddress && (
                      <p className="text-xs md:text-sm text-gray-600 leading-relaxed line-clamp-2">
                        {locationAddress}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Location Details */}
          <div className="p-6 md:p-8 space-y-6">
            {/* Venue Name & Address */}
            <div className="space-y-3">
              {locationName && (
                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold">
                  {locationName}
                </h3>
              )}

              {locationAddress && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                  <p className="text-muted-foreground leading-relaxed">
                    {locationAddress}
                  </p>
                </div>
              )}
            </div>

            {/* Getting There */}
            <div className="space-y-3">
              <h4 className="font-semibold">Getting There</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Public transport available nearby</p>
                <p>• Parking may be limited</p>
                <p>• Arrive 15-30 minutes early</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleGetDirections}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="sm:w-auto border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                onClick={handleShareLocation}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Location Info */}
      {locationName && (
        <div>
          <Card className="p-6 bg-muted/30 border border-border/30">
            <div className="text-center space-y-2">
              <h4 className="font-semibold">Need Help Finding the Venue?</h4>
              <p className="text-sm text-muted-foreground">
                Contact the event organizer if you need assistance with
                directions or accessibility information.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/80"
                asChild
              >
                <Link
                  href={`/contact?regarding=event&eventId=${
                    event.id
                  }&eventName=${encodeURIComponent(event.name || "")}`}
                >
                  Contact Support
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
