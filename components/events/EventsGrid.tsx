"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, Clock, Users, Ticket } from "lucide-react";
import { Event } from "@/types/events.types";

interface EventsGridProps {
  events: Event[];
}

export function EventsGrid({ events }: EventsGridProps) {
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
    };
  };

  const getEventStatus = (startTime: string, endTime?: string) => {
    const now = new Date();
    const eventStart = new Date(startTime);
    const eventEnd = endTime ? new Date(endTime) : null;

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

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
      {events.map((event, index) => {
        const eventDate = formatEventDate(event.start_time);
        const status = getEventStatus(event.start_time, event.end_time);

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
          >
            <Link href={`/events/${event.slug}`}>
              <Card className="group h-full overflow-hidden border border-border/50 hover:border-primary/30 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:shadow-premium">
                {/* Event Image Placeholder */}
                <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                  {/* Date Badge */}
                  <div className="absolute top-4 left-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 text-center border border-white/20">
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        {eventDate.month}
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        {eventDate.day}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {eventDate.weekday}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <Badge
                      variant={status.variant}
                      className="bg-background/90 backdrop-blur-sm"
                    >
                      {status.text}
                    </Badge>
                  </div>

                  {/* Hover Effect */}
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Placeholder Pattern */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Calendar className="w-16 h-16 text-primary/30" />
                  </div>
                </div>

                {/* Event Content */}
                <div className="p-6 space-y-4">
                  {/* Event Title */}
                  <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {event.name}
                  </h3>

                  {/* Event Description */}
                  {event.description && (
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* Event Details */}
                  <div className="space-y-2">
                    {/* Time */}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2 text-primary" />
                      <span>{eventDate.time}</span>
                    </div>

                    {/* Location */}
                    {event.location_name && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mr-2 text-primary" />
                        <span className="line-clamp-1">
                          {event.location_name}
                        </span>
                      </div>
                    )}

                    {/* Organizer */}
                    {event.organizer_name && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="w-4 h-4 mr-2 text-primary" />
                        <span>by {event.organizer_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Section */}
                  <div className="flex items-center justify-end pt-2 border-t border-border/50">
                    {/* Get Tickets Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80 group-hover:bg-primary/10 ml-auto"
                    >
                      <Ticket className="w-4 h-4 mr-1" />
                      View Event
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
