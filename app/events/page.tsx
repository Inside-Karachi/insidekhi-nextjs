import { createServerSupabase } from "@/lib/supabase/server";
import { EventsHero } from "@/components/events/EventsHero";
import { FeaturedEventsPreview } from "@/components/events/FeaturedEventsPreview";
import { EventsContent } from "@/components/events/EventsContent";
import { Event, EventWithDetails, EventImage } from "@/types/events.types";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";

// Enable ISR with 60 second revalidation for events listing
export const revalidate = 60;

interface EventsPageProps {
  searchParams: Promise<{
    category?: string;
    location?: string;
    date?: string;
    search?: string;
  }>;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const supabase = await createServerSupabase({ publicAnon: true });
  const params = await searchParams;

  // Build the query based on search parameters
  // Attempt to fetch featured events first (view exposes event_is_featured/event_featured_rank)
  const featuredQueryBase = supabase
    .from("events_with_details")
    .select("*")
    .eq("event_status", "published")
    .gte("start_time", new Date().toISOString());

  let featuredRows: EventWithDetails[] = [];
  try {
    const { data: featuredData } = await featuredQueryBase
      .eq("is_featured", true)
      .order("featured_rank", { ascending: false })
      .order("event_id", { ascending: true }); // Deterministic tie-breaker
    featuredRows = (featuredData || []) as EventWithDetails[];
  } catch {
    // If the view or fields are not available, keep featuredRows empty (no fallback to top items)
    featuredRows = [];
  }

  // Build main events query; exclude any featured IDs if we have them
  let query = supabase
    .from("events_with_details")
    .select("*")
    .eq("event_status", "published")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .order("event_id", { ascending: true }); // Deterministic tie-breaker

  // We'll exclude featured IDs below after mapping featuredRows -> featuredEvents

  // Apply filters
  if (params.search) {
    const term = sanitizeSearchTerm(params.search);
    if (term) {
      query = query.ilike("event_name", `%${term}%`);
    }
  }

  if (params.location) {
    query = query.ilike("address", `%${params.location}%`);
  }

  if (params.date) {
    const filterDate = new Date(params.date);
    if (!isNaN(filterDate.getTime())) {
      const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
      query = query
        .gte("start_time", filterDate.toISOString())
        .lt("start_time", nextDay.toISOString());
    }
  }

  if (params.category) {
    const categoryKeywords: Record<string, string[]> = {
      food: ["food", "festival", "dining", "restaurant", "cafe"],
      tech: ["tech", "meetup", "startup", "technology", "development"],
      art: ["art", "culture", "exhibition", "gallery"],
      music: ["music", "concert", "fusion", "performance"],
      business: ["business", "entrepreneur", "corporate"],
      networking: ["networking", "meetup", "community", "social"],
      sports: ["gaming", "tournament", "sport", "competition"],
      health: ["health", "wellness", "fitness", "expo"],
      education: ["workshop", "learning", "education", "training"],
      entertainment: ["entertainment", "show", "comedy", "standup", "film"],
    };
    const keywords = categoryKeywords[params.category];
    if (keywords) {
      const orClauses = keywords
        .map((kw) => `event_name.ilike.%${kw}%,event_description.ilike.%${kw}%`)
        .join(",");
      query = query.or(orClauses);
    }
  }

  const { data: eventsData } = await query.limit(200);

  // If we have events, fetch their images and attach to each event
  const eventIds = (eventsData || [])
    .map((r: EventWithDetails) => r.event_id)
    .filter(Boolean) as number[];
  // Fetch only primary (or display_order = 1) images for the event IDs to reduce payload
  const allEventImagesResponse =
    eventIds.length > 0
      ? await supabase
          .from("event_images")
          .select("*")
          .in("event_id", eventIds)
          .or("is_primary.eq.true,display_order.eq.1")
          .order("display_order", { ascending: true })
      : { data: [] as EventImage[] };

  const allEventImages: EventImage[] = (allEventImagesResponse.data ||
    []) as EventImage[];

  // Build a map of event_id -> first image (primary or first by display_order)
  const primaryImageByEvent = new Map<number, EventImage>();
  for (const img of allEventImages) {
    if (!primaryImageByEvent.has(img.event_id)) {
      primaryImageByEvent.set(img.event_id, img);
    }
  }

  // Helper to map DB row to Event (attach only primary image)
  const mapRowToEvent = (row: EventWithDetails): Event => {
    const eid = row.event_id!;
    return {
      id: eid,
      name: row.event_name!,
      slug: row.event_slug!,
      description: row.event_description,
      start_time: row.start_time!,
      end_time: row.end_time!,
      status: row.event_status!,
      organizer_id: row.organizer_id!,
      organizer_name: row.organizer_name,
      organizer_avatar: row.organizer_avatar,
      location_name: row.location_name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      images: primaryImageByEvent.get(eid)
        ? [primaryImageByEvent.get(eid)!]
        : [],
    };
  };

  const events: Event[] = (eventsData || [])
    .filter((row: EventWithDetails) =>
      Boolean(
        row.event_id &&
        row.event_name &&
        row.event_slug &&
        row.start_time &&
        row.end_time &&
        row.event_status &&
        row.organizer_id,
      ),
    )
    .map(mapRowToEvent);

  // Use only DB-marked featured events. No fallback to top N items.
  const featuredEvents: Event[] = (featuredRows || [])
    .filter((r) => r.event_id && r.event_name)
    .map(mapRowToEvent);

  const featuredIds = featuredEvents.map((f) => f.id);
  const upcomingEvents = events.filter((e) => !featuredIds.includes(e.id));

  return (
    <div className="min-h-screen bg-background">
      {/* Events Hero Section */}
      <EventsHero totalEvents={events.length} />

      {/* Main Content */}
      <div
        id="events-list"
        className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16"
      >
        <FeaturedEventsPreview featuredEvents={featuredEvents} />
        <EventsContent initialEvents={upcomingEvents} allEvents={events} />
      </div>
    </div>
  );
}

export async function generateMetadata({ searchParams }: EventsPageProps) {
  const params = await Promise.resolve(searchParams || {});
  const title = params.search
    ? `"${params.search}" Events in Karachi`
    : "Events in Karachi - Inside Karachi";

  return {
    title,
    description:
      "Discover amazing events happening in Karachi. From cultural festivals to tech meetups, find your next experience.",
  };
}
