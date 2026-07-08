import { query } from "@/lib/db";
import { TrendingEventsSection } from "@/components/homepage/TrendingEventsSection";
import { formatEventDate } from "@/lib/utils/date-utils";

export async function TrendingEventsContainer() {
  let upcomingEventRows;
  try {
    const res = await query(
      `SELECT 
        event_id,
        event_name,
        event_slug,
        event_description,
        start_time,
        end_time,
        location_name,
        address
       FROM events_with_details
       WHERE event_status = 'published' AND start_time >= $1
       ORDER BY start_time ASC, event_id ASC
       LIMIT 3`,
      [new Date().toISOString()]
    );
    upcomingEventRows = res.rows;
  } catch (eventsError: any) {
    console.error("Error fetching trending events", eventsError);
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
      [] as any[],
    ) || [];

  const eventIds = uniqueUpcomingEventRows
    .map((event) => event.event_id)
    .filter((eventId): eventId is number => typeof eventId === "number");

  let ticketTypesByEvent = new Map<number, { name: string; price: number }[]>();

  if (eventIds.length > 0) {
    try {
      const resTickets = await query(
        `SELECT event_id, name, price FROM ticket_types WHERE event_id = ANY($1) ORDER BY price ASC`,
        [eventIds]
      );
      const ticketTypes = resTickets.rows;
      
      ticketTypesByEvent = ticketTypes.reduce((acc, ticketType) => {
        if (typeof ticketType.event_id !== "number") return acc;
        const existing = acc.get(ticketType.event_id) || [];
        existing.push({ name: ticketType.name, price: Number(ticketType.price) });
        acc.set(ticketType.event_id, existing);
        return acc;
      }, new Map<number, { name: string; price: number }[]>());
    } catch (ticketTypesError) {
      console.warn("Error fetching ticket types for trending events", ticketTypesError);
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
