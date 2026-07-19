import { query } from "@/lib/db";
import { SimilarEventsCarousel } from "@/components/events/SimilarEventsCarousel";
import { Event } from "@/types/events.types";

interface SimilarEventsContainerProps {
  eventId: number;
}

export async function SimilarEventsContainer({
  eventId,
}: SimilarEventsContainerProps) {
  const { rows: similarEvents } = await query(
    `SELECT * FROM events_with_details
     WHERE event_id != $1 AND event_status = 'published' AND start_time >= $2
     ORDER BY start_time ASC LIMIT 6`,
    [eventId, new Date().toISOString()],
  );

  if (!similarEvents || similarEvents.length === 0) {
    return null;
  }

  // Fetch images for similar events
  const similarEventIds = similarEvents
    .map((e) => Number(e.event_id))
    .filter((id): id is number => Boolean(id));

  const { rows: similarEventImages } =
    similarEventIds.length > 0
      ? await query(
          `SELECT * FROM event_images WHERE event_id = ANY($1) ORDER BY display_order ASC`,
          [similarEventIds],
        )
      : { rows: [] as { event_id: number }[] };

  // Map similar events to Event type
  const mappedSimilarEvents: Event[] = similarEvents
    .filter(
      (row) =>
        row.event_id &&
        row.event_name &&
        row.event_slug &&
        row.start_time &&
        row.end_time &&
        row.event_status &&
        row.organizer_id,
    )
    .map((row) => ({
      id: Number(row.event_id),
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
      images:
        similarEventImages?.filter(
          (img) => Number(img.event_id) === Number(row.event_id),
        ) || [],
    }));

  if (mappedSimilarEvents.length === 0) {
    return null;
  }

  return (
    <SimilarEventsCarousel
      similarEvents={mappedSimilarEvents}
      currentEventId={eventId}
    />
  );
}
