import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  EVENT_CARD_COLUMNS,
  EVENT_IMAGE_COLUMNS,
  TICKET_TYPE_COLUMNS,
  toEventCard,
  toEventImage,
  toTicketType,
  type EventCardRow,
  type EventImageRow,
  type TicketTypeRow,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const MAX_EVENT_IMAGES = 20;

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
  const supabase = createMobilePublicClient();

  const { data: eventRow, error: eventError } = await supabase
    .from("events_with_details")
    .select(EVENT_CARD_COLUMNS)
    .eq("event_slug", slug)
    .eq("event_status", "published")
    .returns<EventCardRow[]>()
    .maybeSingle();

  if (eventError || !eventRow || eventRow.event_id == null) {
    throw new MobileApiError("not_found", "Event not found.", 404);
  }

  const eventId = eventRow.event_id;

  const [imagesRes, ticketsRes] = await Promise.all([
    supabase
      .from("event_images")
      .select(EVENT_IMAGE_COLUMNS)
      .eq("event_id", eventId)
      .order("display_order", { ascending: true })
      .limit(MAX_EVENT_IMAGES)
      .returns<EventImageRow[]>(),
    supabase
      .from("ticket_types")
      .select(TICKET_TYPE_COLUMNS)
      .eq("event_id", eventId)
      .order("price", { ascending: true })
      .order("id", { ascending: true })
      .returns<TicketTypeRow[]>(),
  ]);

  return ok({
    event: toEventCard(eventRow),
    images: (imagesRes.data ?? []).map(toEventImage),
    ticket_types: (ticketsRes.data ?? []).map(toTicketType),
  });
});
