"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Calendar, Verified, Phone, Globe } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EventOrganizerProps } from "@/types/events.types";
import Link from "next/link";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

interface OrganizerStats {
  eventsOrganized: number;
  totalAttendees: number;
  upcomingEvents: number;
}

interface OrganizerData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  isVerified: boolean;
  bio: string | null;
  company: string | null;
  website: string | null;
}

interface RecentEvent {
  id: number;
  name: string;
  slug: string;
  start_time: string;
  end_time: string;
}

export function EventOrganizer({ event }: EventOrganizerProps) {
  const [organizerData, setOrganizerData] =
    React.useState<OrganizerData | null>(null);
  const [stats, setStats] = React.useState<OrganizerStats>({
    eventsOrganized: 0,
    totalAttendees: 0,
    upcomingEvents: 0,
  });
  const [recentEvents, setRecentEvents] = React.useState<RecentEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    if (!event.organizer_id) return;

    fetch(`/api/organizer/${event.organizer_id}/stats`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setOrganizerData(data.data.organizer);
          setStats(data.data.stats);
          setRecentEvents(data.data.recentEvents || []);
        } else {
          setHasError(true);
        }
      })
      .catch((error) => {
        console.error("Error fetching organizer stats:", error);
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [event.organizer_id]);

  if (!event.organizer_name) {
    return null;
  }

  // Show minimal card if there's an error fetching organizer data (e.g., admin/lister)
  if (hasError && !isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Event <span className="gradient-text-primary">Organizer</span>
            </PremiumHeading>
          </div>
        </div>
        <Card className="group relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border-2 md:border rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 md:h-20 md:w-20 border-4 border-primary/20">
              <AvatarImage src={event.organizer_avatar || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl md:text-2xl font-bold">
                {event.organizer_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg md:text-xl font-bold">
                {event.organizer_name}
              </h3>
              <p className="text-muted-foreground text-sm">Event Organizer</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Event <span className="gradient-text-primary">Organizer</span>
            </PremiumHeading>
          </div>
        </div>
        <Card className="group relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border-2 md:border rounded-2xl p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Avatar Skeleton */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 lg:flex-col lg:items-center lg:min-w-[200px]">
              <Skeleton className="h-24 w-24 md:h-32 md:w-32 rounded-full" />
              <div className="text-center sm:text-left lg:text-center space-y-3 w-full">
                <Skeleton className="h-6 w-32 mx-auto sm:mx-0 lg:mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto sm:mx-0 lg:mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto sm:mx-0 lg:mx-auto" />
              </div>
            </div>
            {/* Stats Skeleton */}
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 bg-card/50 rounded-xl border border-border/30"
                  >
                    <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    <Skeleton className="h-3 w-20 mx-auto" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <PremiumHeading level={2} dense className="text-foreground">
            Event <span className="gradient-text-primary">Organizer</span>
          </PremiumHeading>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
            Meet the team behind this amazing event experience.
          </p>
        </div>
      </div>

      {/* Organizer Card */}
      <div>
        <Card className="group relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl p-6 md:p-8 hover:shadow-premium hover:shadow-primary/20 hover:border-primary/40 hover:scale-[1.01] transition-all duration-300">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Organizer Avatar & Basic Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 lg:flex-col lg:items-center lg:min-w-[200px]">
              <div className="relative">
                <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-primary/20">
                  <AvatarImage src={event.organizer_avatar || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl md:text-3xl font-bold">
                    {event.organizer_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {organizerData?.isVerified && (
                  <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-2">
                    <Verified className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="text-center sm:text-left lg:text-center">
                <div className="flex items-center justify-center sm:justify-start lg:justify-center gap-2 mb-2">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold">
                    {event.organizer_name}
                  </h3>
                  {organizerData?.isVerified && (
                    <Badge
                      variant="default"
                      className="bg-primary/10 text-primary border-primary/20"
                    >
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mb-3">
                  {organizerData?.company || "Event Organizer"}
                </p>
              </div>
            </div>

            {/* Organizer Stats & Details */}
            <div className="flex-1 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-xl">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {stats.eventsOrganized}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Events Organized
                  </div>
                </div>

                <div className="text-center p-4 bg-muted/30 rounded-xl">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {stats.totalAttendees.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Attendees
                  </div>
                </div>

                <div className="text-center p-4 bg-muted/30 rounded-xl col-span-2 md:col-span-1">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {stats.upcomingEvents}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Upcoming Events
                  </div>
                </div>
              </div>

              {/* About Organizer */}
              {organizerData?.bio && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">About the Organizer</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {organizerData.bio}
                  </p>
                </div>
              )}

              {/* Previous Events Preview */}
              {recentEvents.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Recent Events</h4>
                  <div className="space-y-3">
                    {recentEvents.map((pastEvent) => (
                      <Link
                        key={pastEvent.id}
                        href={`/events/${pastEvent.slug}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between p-3 bg-muted/40 dark:bg-muted/20 rounded-lg hover:bg-muted/60 transition-colors">
                          <div>
                            <div className="font-medium">{pastEvent.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(
                                pastEvent.start_time,
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {/* Only show contact button for actual organizers (not admin/lister) */}
                {organizerData?.phone &&
                  organizerData?.role === "organizer" && (
                    <Button
                      variant="outline"
                      className="flex-1 border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                      asChild
                    >
                      <a href={`tel:${organizerData.phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Contact Organizer
                      </a>
                    </Button>
                  )}

                {/* Only show View All Events for actual organizers */}
                {organizerData?.username &&
                  organizerData?.role === "organizer" && (
                    <Button
                      variant="outline"
                      className="flex-1 border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                      asChild
                    >
                      <Link href={`/organizer/${organizerData.username}`}>
                        <Calendar className="w-4 h-4 mr-2" />
                        View All Events
                      </Link>
                    </Button>
                  )}

                {organizerData?.website && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="sm:w-auto border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                    asChild
                  >
                    <a
                      href={organizerData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
