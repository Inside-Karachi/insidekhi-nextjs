"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  Users,
  Star,
} from "lucide-react";
import type { Event, EventPreview } from "@/types/events.types";

type TrendingEventSource = Event | EventPreview;

interface TrendingEventCardProps {
  event: TrendingEventSource;
  showAnimation?: boolean;
}

export function TrendingEventCard({
  event,
  showAnimation = true,
}: TrendingEventCardProps) {
  // Use pre-formatted dates if available (server-side formatted for hydration safety)
  // Fall back to client-side formatting only if needed
  const getFormattedDateTime = (dateString: string) => {
    // If we have pre-formatted dates from server, use them
    const eventWithFormattedDate = event as EventPreview & {
      formatted_date?: { date: string; time: string; full: string };
    };

    if (eventWithFormattedDate.formatted_date) {
      return {
        date: eventWithFormattedDate.formatted_date.date,
        time: eventWithFormattedDate.formatted_date.time,
      };
    }

    // Fallback to client-side formatting (only if pre-formatted not available)
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const getMinPrice = (ticketTypes?: { name: string; price: number }[]) => {
    if (!ticketTypes || ticketTypes.length === 0) return null;
    return Math.min(...ticketTypes.map((t) => t.price));
  };

  // type guards
  const asRecord = (v: unknown) => v as Record<string, unknown>;

  const hasTicketTypes = (
    e: TrendingEventSource
  ): e is EventPreview & {
    ticket_types: { name: string; price: number }[];
  } => {
    const r = asRecord(e);
    return Boolean(r["ticket_types"] && Array.isArray(r["ticket_types"]));
  };

  const hasListingObject = (
    e: TrendingEventSource
  ): e is EventPreview & {
    listing: { name?: string; address?: string | null };
  } => {
    const r = asRecord(e);
    return Boolean(r["listing"] && typeof r["listing"] === "object");
  };

  const startDateTime = getFormattedDateTime(event.start_time);

  const minPrice = hasTicketTypes(event)
    ? getMinPrice(
        asRecord(event)["ticket_types"] as { name: string; price: number }[]
      )
    : null;

  type ListingRecord = { name?: string; address?: string | null };

  const listingName =
    (asRecord(event)["listing_name"] as string | undefined) ??
    (hasListingObject(event)
      ? (asRecord(event)["listing"] as ListingRecord).name
      : undefined);

  const listingAddress =
    (asRecord(event)["listing_address"] as string | undefined) ??
    (hasListingObject(event)
      ? (asRecord(event)["listing"] as ListingRecord).address
      : undefined);

  return (
    <motion.div
      initial={showAnimation ? { opacity: 0, y: 40 } : undefined}
      animate={showAnimation ? { opacity: 1, y: 0 } : undefined}
      whileHover={{ y: -8 }}
      className="group h-full"
    >
      <Link href={`/events/${event.slug}`}>
        <div className="relative bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl md:rounded-3xl shadow-premium hover:shadow-premium-lg transition-all duration-500 overflow-hidden h-full flex flex-col">
          <div className="relative p-4 md:p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="p-2 md:p-3 rounded-xl bg-primary/20 border border-primary/30">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div>
                  <div className="text-base md:text-lg font-bold text-foreground">
                    {startDateTime.date}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">
                    {startDateTime.time}
                  </div>
                </div>
              </div>

              <Badge className="bg-orange-500/20 text-orange-600 border border-orange-500/30 text-xs px-2 py-1">
                <Star className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Trending</span>
                <span className="sm:hidden">Hot</span>
              </Badge>
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-3 md:space-y-4 flex-1 min-h-0">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-2">
              {event.name}
            </h3>

            {event.description && (
              <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
                {event.description}
              </p>
            )}

            {listingName ? (
              <div className="flex items-start space-x-2 text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="text-sm min-w-0 flex-1">
                  <div className="font-medium text-foreground line-clamp-1">
                    {listingName}
                  </div>
                  <div className="line-clamp-1 text-xs md:text-sm">
                    {listingAddress}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 md:pt-4 border-t border-border/50 space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {minPrice
                    ? `From PKR ${minPrice.toLocaleString()}`
                    : "Free Event"}
                </span>
              </div>

              <div className="flex items-center space-x-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-xs">
                  {((event.id * 73) % 200) + 50} interested
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 pt-0">
            <Button className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/30 hover:border-primary transition-all duration-300 group/btn text-sm md:text-base py-2 md:py-3">
              <span>Get Tickets</span>
              <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
            </Button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-primary/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </div>
      </Link>
    </motion.div>
  );
}
