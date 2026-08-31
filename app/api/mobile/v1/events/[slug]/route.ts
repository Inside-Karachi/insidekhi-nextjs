import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  toEventCard,
  toEventImage,
  toTicketType,
  type EventCardRow,
  type EventImageRow,
  type TicketTypeRow,
} from "@/lib/mobile/mappers";
import { getAttendeesPreviewByEvent } from "@/lib/mobile/attendees";

export const dynamic = "force-dynamic";

const MAX_EVENT_IMAGES = 20;

const EVENT_CARD_SQL_COLUMNS =
  "event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(start_time) #>> '{}' AS start_time, " +
  "to_json(end_time) #>> '{}' AS end_time, " +
  "is_featured, organizer_id, organizer_name, organizer_avatar, location_name, address, latitude, longitude";

const EVENT_IMAGE_SQL_COLUMNS = "id, url, alt_text, display_order";

const TICKET_TYPE_SQL_COLUMNS =
  "id, name, price, quantity_available, " +
  "to_json(sale_starts_at) #>> '{}' AS sale_starts_at, " +
  "to_json(sale_ends_at) #>> '{}' AS sale_ends_at";

/**
 * GET /api/mobile/v1/events/{slug}
 *
 * Aggregated event detail for the mobile detail screen - mirrors what the
 * website's server component (`app/events/[slug]/page.tsx`) assembles, in one
 * round trip. Published-only; unpublished or unknown slug -> 404. `ticket_types`
 * drives checkout. Events are self-contained (own `location_name`/`address`);
 * they are not linked to listings, so there are no event reviews.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);

  const { slug } = await params;

  const { rows: eventRows } = await query(
    `SELECT ${EVENT_CARD_SQL_COLUMNS} FROM events_with_details
     WHERE event_slug = $1 AND event_status = 'published'`,
    [slug],
  );
  const eventRow = eventRows[0];

  if (!eventRow || eventRow.event_id == null) {
    throw new MobileApiError("not_found", "Event not found.", 404);
  }

  const eventId = Number(eventRow.event_id);

  const [imagesRes, ticketsRes, organizerRes] = await Promise.all([
    query(
      `SELECT ${EVENT_IMAGE_SQL_COLUMNS} FROM event_images
       WHERE event_id = $1 ORDER BY display_order ASC LIMIT $2`,
      [eventId, MAX_EVENT_IMAGES],
    ),
    query(
      `SELECT ${TICKET_TYPE_SQL_COLUMNS} FROM ticket_types
       WHERE event_id = $1 ORDER BY price ASC, id ASC`,
      [eventId],
    ),
    eventRow.organizer_id
      ? query(
          `SELECT username, is_verified_organizer FROM profiles WHERE id = $1`,
          [eventRow.organizer_id],
        )
      : Promise.resolve({ rows: [] as { username: string | null; is_verified_organizer: boolean | null }[] }),
  ]);

  const images = imagesRes.rows.map(
    (row) => ({ ...row, id: Number(row.id) }) as unknown as EventImageRow,
  );

  // TEMP PREVIEW ONLY - revert before commit
  if (eventId === 85 && images.length === 0) {
    images.push({
      id: -1,
      url: "http://localhost:3000/tmp-preview-farmhouse.jpg",
      alt_text: "Paaltu FarmHouse preview",
      display_order: 1,
    } as unknown as EventImageRow);
  }
  const tickets = ticketsRes.rows.map(
    (row) =>
      ({
        ...row,
        id: Number(row.id),
        price: row.price !== null ? Number(row.price) : null,
      }) as unknown as TicketTypeRow,
  );

  const organizerProfile = organizerRes.rows[0];

  // "N people going" for the detail screen's attendee strip. Fail-soft and
  // sequential (not folded into the Promise.all above): the production pool is
  // capped at one connection per instance, so a slow "who's going" lookup must
  // never contend for it or 500 the whole screen — same stance the events list
  // route takes. A timeout here just drops the strip.
  let attendeesPreview: Awaited<ReturnType<typeof getAttendeesPreviewByEvent>> =
    new Map();
  try {
    attendeesPreview = await getAttendeesPreviewByEvent([eventId]);
  } catch (error) {
    console.error("[mobile-api] event detail attendees query failed:", error);
  }

  return ok({
    event: {
      ...toEventCard(
        {
          ...eventRow,
          event_id: eventId,
        } as unknown as EventCardRow,
        attendeesPreview.get(eventId),
      ),
      organizer_username: organizerProfile?.username ?? null,
      organizer_is_verified: organizerProfile?.is_verified_organizer ?? false,
    },
    images: images.map(toEventImage),
    ticket_types: tickets.map(toTicketType),
  });
});
