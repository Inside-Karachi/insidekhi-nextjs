import { createServerSupabase } from "@/lib/supabase/server";
import { SimilarEventsCarousel } from "@/components/events/SimilarEventsCarousel";
import { Event } from "@/types/events.types";

interface SimilarEventsContainerProps {
  eventId: number;
}

export async function SimilarEventsContainer({
  eventId,
}: SimilarEventsContainerProps) {
  const supabase = await createServerSupabase({ publicAnon: true });

  const { data: similarEvents } = await supabase
    .from("events_with_details")
    .select("*")
    .neq("event_id", eventId)
    .eq("event_status", "published")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(6);

  if (!similarEvents || similarEvents.length === 0) {
    return null;
  }

  // Fetch images for similar events
  const similarEventIds = similarEvents
    .map((e) => e.event_id)
    .filter((id): id is number => Boolean(id));

  const { data: similarEventImages } =
    similarEventIds.length > 0
      ? await supabase
          .from("event_images")
          .select("*")
          .in("event_id", similarEventIds)
          .order("display_order", { ascending: true })
      : { data: [] };

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
      id: row.event_id!,
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
        similarEventImages?.filter((img) => img.event_id === row.event_id) ||
        [],
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
