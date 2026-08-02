import { query } from "@/lib/db";
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
  const params = await searchParams;
  const nowIso = new Date().toISOString();

  // Attempt to fetch featured events first (view exposes is_featured/featured_rank)
  let featuredRows: EventWithDetails[] = [];
  try {
    const { rows } = await query(
      `SELECT * FROM events_with_details
       WHERE event_status = 'published' AND start_time >= $1 AND is_featured = true
       ORDER BY featured_rank DESC NULLS LAST, event_id ASC`,
      [nowIso],
    );
    featuredRows = rows as EventWithDetails[];
  } catch {
    // If the view or fields are not available, keep featuredRows empty (no fallback to top items)
    featuredRows = [];
  }

  // Build main events query; exclude any featured IDs if we have them
  const whereClauses = ["event_status = 'published'", "start_time >= $1"];
  const queryParams: unknown[] = [nowIso];

  if (params.search) {
    const term = sanitizeSearchTerm(params.search);
    if (term) {
      queryParams.push(`%${term}%`);
      whereClauses.push(`event_name ILIKE $${queryParams.length}`);
    }
  }

  if (params.location) {
    queryParams.push(`%${params.location}%`);
    whereClauses.push(`address ILIKE $${queryParams.length}`);
  }

  if (params.date) {
    const filterDate = new Date(params.date);
    if (!isNaN(filterDate.getTime())) {
      const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
      queryParams.push(filterDate.toISOString());
      whereClauses.push(`start_time >= $${queryParams.length}`);
      queryParams.push(nextDay.toISOString());
      whereClauses.push(`start_time < $${queryParams.length}`);
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
        .map((kw) => {
          queryParams.push(`%${kw}%`);
          const nameParam = queryParams.length;
          queryParams.push(`%${kw}%`);
          const descParam = queryParams.length;
          return `event_name ILIKE $${nameParam} OR event_description ILIKE $${descParam}`;
        })
        .join(" OR ");
      whereClauses.push(`(${orClauses})`);
    }
  }

  const whereSql = whereClauses.join(" AND ");
  const { rows: eventsData } = await query(
    `SELECT * FROM events_with_details
     WHERE ${whereSql}
     ORDER BY start_time ASC, event_id ASC
     LIMIT 200`,
    queryParams,
  );

  // If we have events, fetch their images and attach to each event
  const eventIds = (eventsData || [])
    .map((r: EventWithDetails) => r.event_id)
    .filter(Boolean) as number[];
  // Fetch only primary (or display_order = 1) images for the event IDs to reduce payload
  let allEventImages: EventImage[] = [];
  if (eventIds.length > 0) {
    const { rows: imageRows } = await query(
      `SELECT * FROM event_images
       WHERE event_id = ANY($1) AND (is_primary = true OR display_order = 1)
       ORDER BY display_order ASC`,
      [eventIds],
    );
    allEventImages = imageRows as EventImage[];
  }

  // Build a map of event_id -> first image (primary or first by display_order)
  const primaryImageByEvent = new Map<number, EventImage>();
  for (const img of allEventImages) {
    const imgEventId = Number(img.event_id);
    if (!primaryImageByEvent.has(imgEventId)) {
      primaryImageByEvent.set(imgEventId, img);
    }
  }

  // TEMP PREVIEW ONLY - revert before commit
  if (!primaryImageByEvent.has(85)) {
    primaryImageByEvent.set(85, {
      id: -1,
      event_id: 85,
      url: "/tmp-preview-farmhouse.jpg",
      alt_text: "Paaltu FarmHouse preview",
      is_primary: true,
      display_order: 1,
    } as EventImage);
  }

  // Helper to map DB row to Event (attach only primary image)
  const mapRowToEvent = (row: EventWithDetails): Event => {
    const eid = Number(row.event_id);
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
