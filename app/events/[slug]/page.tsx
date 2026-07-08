import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EventHero } from "@/components/events/EventHero";
import { EventOrganizer } from "@/components/events/EventOrganizer";
import { EventLocation } from "@/components/events/EventLocation";
import { AnimatedSection } from "@/components/events/AnimatedSection";
import { PremiumGallery } from "@/components/listing/PremiumGallery";
import { ExternalLink } from "lucide-react";
import { Event, EventImage } from "@/types/events.types";
import { PremiumHeading } from "@/components/brand/Typography";
import { getEventGalleryImages } from "@/lib/utils/listing-images";
import { EventSidebarButton } from "@/components/events/EventSidebarButton";
import { ReportIssueButton } from "@/components/shared/ReportIssueButton";
import { Suspense } from "react";

// Containers
import { EventTicketsContainer } from "@/components/events/containers/EventTicketsContainer";
import { SimilarEventsContainer } from "@/components/events/containers/SimilarEventsContainer";

// Skeletons
import {
  TicketSkeleton,
  SimilarEventsSkeleton,
} from "@/components/events/skeletons";

// Enable ISR with 60 second revalidation for event pages
export const revalidate = 60;

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createServerSupabase({ publicAnon: true });
  const { slug } = await params;

  // Query the events view - Critical Data
  const { data: eventRow } = await supabase
    .from("events_with_details")
    .select("*")
    .eq("event_slug", slug)
    .single();

  if (!eventRow) notFound();

  // Map event row to our Event type
  const event: Event = {
    id: eventRow.event_id!,
    name: eventRow.event_name!,
    slug: eventRow.event_slug!,
    description: eventRow.event_description,
    start_time: eventRow.start_time!,
    end_time: eventRow.end_time!,
    status: eventRow.event_status!,
    organizer_id: eventRow.organizer_id!,
    organizer_name: eventRow.organizer_name,
    organizer_avatar: eventRow.organizer_avatar,
    location_name: eventRow.location_name,
    address: eventRow.address,
    latitude: eventRow.latitude,
    longitude: eventRow.longitude,
  };

  // Fetch images for THIS event immediately as they are part of the critical hero/gallery
  const { data: eventImagesData } = await supabase
    .from("event_images")
    .select("*")
    .eq("event_id", event.id)
    .order("display_order", { ascending: true });

  // Explicitly cast to prevent type errors with nulls from Supabase
  const eventImages = (eventImagesData || []) as EventImage[];

  // Get hero images from event_images table
  const heroImages =
    eventImages && eventImages.length > 0
      ? eventImages.map((img) => img.url)
      : [
          "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
        ];

  return (
    <div className="min-h-screen bg-background">
      {/* Event Hero Section */}
      <EventHero event={event} images={heroImages} withTopMargin={false} />

      {/* MainContent */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 md:gap-16 lg:gap-20">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-12 md:space-y-16 lg:space-y-20">
            {/* Event Description */}
            {event.description && (
              <AnimatedSection className="space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                    <ExternalLink className="w-5 h-5 text-primary" />
                  </div>
                  <PremiumHeading level={2} dense className="text-foreground">
                    About This{" "}
                    <span className="gradient-text-primary">Event</span>
                  </PremiumHeading>
                </div>
                <div className="prose prose-gray dark:prose-invert max-w-none">
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>
                </div>
              </AnimatedSection>
            )}

            {/* Event Gallery - Show all uploaded images */}
            {eventImages && eventImages.length > 0 && (
              <AnimatedSection>
                <PremiumGallery
                  images={getEventGalleryImages(eventImages)}
                  title="Event Photos"
                />
              </AnimatedSection>
            )}

            {/* Ticket Section */}
            <Suspense fallback={<TicketSkeleton />}>
              <EventTicketsContainer event={event} />
            </Suspense>

            {/* Event Location */}
            <EventLocation event={event} />

            {/* Event Organizer */}
            <AnimatedSection>
              <EventOrganizer event={event} />
            </AnimatedSection>

            {/* Similar Events */}
            <Suspense fallback={<SimilarEventsSkeleton />}>
              <SimilarEventsContainer eventId={event.id} />
            </Suspense>
          </div>

          {/* Right Column - Sidebar */}
          <AnimatedSection className="space-y-8 md:space-y-12">
            <div className="sticky lg:top-20 lg:self-start space-y-8 md:space-y-10 lg:space-y-12">
              <div className="group relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border-2 md:border rounded-2xl p-6 md:p-8 hover:shadow-premium hover:shadow-primary/20 hover:border-primary/40 hover:scale-[1.01] transition-all duration-300 space-y-6">
                <h3 className="text-xl font-semibold">Event Information</h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Date & Time</h4>
                    <p className="text-muted-foreground">
                      {new Date(event.start_time).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.start_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}{" "}
                      -{" "}
                      {new Date(event.end_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                  </div>

                  {event.location_name && (
                    <div>
                      <h4 className="font-medium mb-2">Location</h4>
                      <p className="text-muted-foreground">
                        {event.location_name}
                      </p>
                      {event.address && (
                        <p className="text-sm text-muted-foreground">
                          {event.address}
                        </p>
                      )}
                    </div>
                  )}

                  {event.organizer_name && (
                    <div>
                      <h4 className="font-medium mb-2">Organizer</h4>
                      <p className="text-muted-foreground">
                        {event.organizer_name}
                      </p>
                    </div>
                  )}
                </div>

                <EventSidebarButton />
              </div>

              <div className="flex justify-center">
                <ReportIssueButton
                  reportType="event"
                  itemId={event.id}
                  itemName={event.name}
                  itemSlug={event.slug}
                />
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Use createClient at build time (no cookies needed for public data)
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { slug } = await params;

  const { data: eventRow } = await supabase
    .from("events_with_details")
    .select("event_name, event_description")
    .eq("event_slug", slug)
    .single();

  if (!eventRow) {
    return {
      title: "Event Not Found",
    };
  }

  return {
    title: `${eventRow.event_name} - Inside Karachi Events`,
    description:
      eventRow.event_description?.substring(0, 160) ||
      `Join us for ${eventRow.event_name} - an amazing event in Karachi`,
  };
}
