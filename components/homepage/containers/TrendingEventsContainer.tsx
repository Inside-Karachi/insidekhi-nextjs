import { createServerSupabase } from "@/lib/supabase/server";
import { TrendingEventsSection } from "@/components/homepage/TrendingEventsSection";
import { formatEventDate } from "@/lib/utils/date-utils";

export async function TrendingEventsContainer() {
  const supabase = await createServerSupabase({ useServiceRole: true });

  const { data: upcomingEventRows, error: eventsError } = await supabase
    .from("events_with_details")
    .select(
      `
      event_id,
      event_name,
      event_slug,
      event_description,
      start_time,
      end_time,
      location_name,
      address
    `,
    )
    .eq("event_status", "published")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .order("event_id", { ascending: true })
    .limit(3);

  if (eventsError) {
    console.error("Error fetching trending events", {
      message: eventsError.message,
      details: eventsError.details,
      hint: eventsError.hint,
      code: eventsError.code,
    });
    return null;
  }

  const uniqueUpcomingEventRows =
    upcomingEventRows?.reduce(
      (acc, event) => {
        if (typeof event.event_id !== "number") return acc;
        if (acc.some((existing) => existing.event_id === event.event_id))
          return acc;
        acc.push(event);
        return acc;
      },
      [] as NonNullable<typeof upcomingEventRows>,
    ) || [];

  const eventIds = uniqueUpcomingEventRows
    .map((event) => event.event_id)
    .filter((eventId): eventId is number => typeof eventId === "number");

  let ticketTypesByEvent = new Map<number, { name: string; price: number }[]>();

  if (eventIds.length > 0) {
    const { data: ticketTypes, error: ticketTypesError } = await supabase
      .from("ticket_types")
      .select("event_id, name, price")
      .in("event_id", eventIds)
      .order("price", { ascending: true });

    if (ticketTypesError) {
      // Keep rendering events even when ticket pricing rows are restricted.
      console.warn("Error fetching ticket types for trending events", {
        message: ticketTypesError.message,
        details: ticketTypesError.details,
        hint: ticketTypesError.hint,
        code: ticketTypesError.code,
      });
    } else if (ticketTypes) {
      ticketTypesByEvent = ticketTypes.reduce((acc, ticketType) => {
        if (typeof ticketType.event_id !== "number") return acc;
        const existing = acc.get(ticketType.event_id) || [];
        existing.push({ name: ticketType.name, price: ticketType.price });
        acc.set(ticketType.event_id, existing);
        return acc;
      }, new Map<number, { name: string; price: number }[]>());
    }
  }

  // Pre-format dates on server side to prevent hydration mismatches
  const formattedEvents =
    uniqueUpcomingEventRows
      ?.map((event) => {
        if (
          typeof event.event_id !== "number" ||
          typeof event.event_name !== "string" ||
          typeof event.event_slug !== "string" ||
          typeof event.start_time !== "string" ||
          typeof event.end_time !== "string"
        ) {
          return null;
        }

        return {
          id: event.event_id,
          name: event.event_name,
          slug: event.event_slug,
          description: event.event_description,
          start_time: event.start_time,
          end_time: event.end_time,
          listing_name: event.location_name,
          listing_address: event.address,
          ticket_types: ticketTypesByEvent.get(event.event_id) || [],
          formatted_date: formatEventDate(event.start_time),
        };
      })
      .filter((event): event is NonNullable<typeof event> => event !== null)
      .slice(0, 3) || [];

  return <TrendingEventsSection events={formattedEvents} />;
}
