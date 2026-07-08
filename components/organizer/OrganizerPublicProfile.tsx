"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Verified,
  MapPin,
  Clock,
  TrendingUp,
  Globe,
  Building2,
  Phone,
  Sparkles,
} from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import { EventCard } from "@/components/events/EventCard";
import type { Event } from "@/types/events.types";
import { format } from "date-fns";
import Link from "next/link";

interface OrganizerPublicProfileProps {
  organizer: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    organizer_bio: string | null;
    organizer_company: string | null;
    organizer_website: string | null;
    is_verified_organizer: boolean | null;
    phone: string | null;
  };
  events: Event[];
  upcomingEvents: Event[];
  pastEvents: Event[];
  ongoingEvents: Event[];
  totalAttendees: number;
}

export function OrganizerPublicProfile({
  organizer,
  events,
  upcomingEvents,
  pastEvents,
  ongoingEvents,
  totalAttendees,
}: OrganizerPublicProfileProps) {
  const eventsOrganized = events.length;
  const recentEvents = pastEvents.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section with Gradient */}
      <div className="relative overflow-hidden border-b border-border/50">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background" />
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(var(--primary) / 0.15) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start"
          >
            {/* Avatar & Quick Actions */}
            <div className="flex flex-col items-center lg:items-start gap-6 lg:sticky lg:top-24">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-primary/50 to-primary rounded-full opacity-75 group-hover:opacity-100 blur transition duration-300" />
                <Avatar className="relative h-36 w-36 md:h-44 md:w-44 border-4 border-background shadow-2xl">
                  <AvatarImage
                    src={organizer.avatar_url || undefined}
                    alt={organizer.full_name || "Organizer"}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-5xl md:text-6xl font-bold">
                    {organizer.full_name?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                {organizer.is_verified_organizer && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-3 shadow-xl ring-4 ring-background"
                  >
                    <Verified className="w-7 h-7" />
                  </motion.div>
                )}
              </div>

              {/* Contact Buttons */}
              <div className="flex flex-col w-full gap-3">
                {organizer.phone && (
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full shadow-lg hover:shadow-xl transition-all duration-300"
                    asChild
                  >
                    <a href={`tel:${organizer.phone}`}>
                      <Phone className="w-5 h-5 mr-2" />
                      Contact Organizer
                    </a>
                  </Button>
                )}
                {organizer.organizer_website && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full border-2 hover:border-primary/50 transition-all duration-300"
                    asChild
                  >
                    <a
                      href={organizer.organizer_website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="w-5 h-5 mr-2" />
                      Visit Website
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 w-full space-y-6">
              {/* Name & Badges */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <PremiumHeading
                    level={1}
                    className="text-foreground !text-4xl md:!text-5xl lg:!text-6xl"
                  >
                    {organizer.full_name || "Anonymous Organizer"}
                  </PremiumHeading>
                  {organizer.is_verified_organizer && (
                    <Badge
                      variant="default"
                      className="bg-primary/15 text-primary border-2 border-primary/30 text-base px-4 py-1.5 rounded-full"
                    >
                      <Verified className="w-4 h-4 mr-1.5" />
                      Verified
                    </Badge>
                  )}
                </div>

                {organizer.organizer_company && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Building2 className="w-5 h-5" />
                    <span className="text-lg md:text-xl font-medium">
                      {organizer.organizer_company}
                    </span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {organizer.organizer_bio && (
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <p className="text-muted-foreground leading-relaxed text-base md:text-lg">
                    {organizer.organizer_bio}
                  </p>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="relative overflow-hidden p-6 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="relative">
                      <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-3" />
                      <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                        {eventsOrganized}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        Total Events
                      </div>
                    </div>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="relative overflow-hidden p-6 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/20 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
                    <div className="relative">
                      <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400 mb-3" />
                      <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                        {totalAttendees.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        Total Attendees
                      </div>
                    </div>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="relative overflow-hidden p-6 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
                    <div className="relative">
                      <TrendingUp className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-3" />
                      <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                        {upcomingEvents.length}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        Upcoming
                      </div>
                    </div>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="relative overflow-hidden p-6 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
                    <div className="relative">
                      <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-3" />
                      <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                        {pastEvents.length}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        Past Events
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Events Section */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Tabs defaultValue="upcoming" className="w-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
              <div>
                <PremiumHeading level={2} className="text-foreground mb-2">
                  Event <span className="gradient-text-primary">Portfolio</span>
                </PremiumHeading>
                <p className="text-muted-foreground text-lg">
                  Explore our collection of memorable experiences
                </p>
              </div>
              <TabsList className="grid w-full max-w-md grid-cols-3 h-12 bg-muted/50">
                <TabsTrigger value="upcoming" className="text-sm font-medium">
                  Upcoming ({upcomingEvents.length})
                </TabsTrigger>
                <TabsTrigger value="ongoing" className="text-sm font-medium">
                  Ongoing ({ongoingEvents.length})
                </TabsTrigger>
                <TabsTrigger value="past" className="text-sm font-medium">
                  Past ({pastEvents.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="upcoming" className="mt-0">
              {upcomingEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {upcomingEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <EventCard event={event} showAnimation={false} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <Calendar className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    No Upcoming Events
                  </h3>
                  <p className="text-muted-foreground">
                    Check back soon for new exciting events!
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ongoing" className="mt-0">
              {ongoingEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {ongoingEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <EventCard event={event} showAnimation={false} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <Clock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    No Ongoing Events
                  </h3>
                  <p className="text-muted-foreground">
                    No events are currently happening
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="past" className="mt-0">
              {pastEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {pastEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <EventCard event={event} showAnimation={false} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Past Events</h3>
                  <p className="text-muted-foreground">
                    This organizer is just getting started!
                  </p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Recent Events Highlight */}
      {recentEvents.length > 0 && (
        <div className="bg-muted/30 border-y border-border/50">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16">
            <div className="mb-10">
              <PremiumHeading level={2} className="text-foreground mb-2">
                Recent{" "}
                <span className="gradient-text-primary">Success Stories</span>
              </PremiumHeading>
              <p className="text-muted-foreground text-lg">
                Our most memorable events from the past
              </p>
            </div>

            <div className="space-y-4">
              {recentEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.15 }}
                >
                  <Link href={`/events/${event.slug}`}>
                    <Card className="p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                            {event.name}
                          </h3>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(event.start_time), "PPP")}
                            </span>
                            {event.location_name && (
                              <span className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                {event.location_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
