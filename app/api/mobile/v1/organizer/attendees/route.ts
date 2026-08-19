import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileErrors } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/organizer/attendees?eventId=
 *
 * Attendee list for one event (guest name, masked CNIC, ticket type/price,
 * check-in status/time, buyer contact) + summary stats. Mirrors
 * `app/api/organizer/attendees/route.ts` (web), swapped to Bearer auth via
 * `requireMobileOrganizer` (which also folds in the ownership-or-admin check
 * the web route does inline).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const eventIdParam = searchParams.get("eventId");
  if (!eventIdParam) {
    throw MobileErrors.badRequest("eventId is required.", "eventId");
  }
  const eventId = parseInt(eventIdParam, 10);
  if (Number.isNaN(eventId)) {
    throw MobileErrors.badRequest("eventId must be a number.", "eventId");
  }

  const { user } = await requireMobileOrganizer(request, { eventId });
  await enforceMobileRateLimit(request, user.id);

  const { rows: eventRows } = await query(
    `SELECT id, name FROM events WHERE id = $1`,
    [eventId],
  );
  const event = eventRows[0];
  if (!event) {
    throw MobileErrors.notFound("Event not found.");
  }

  const { rows: passes } = await query(
    `SELECT
       tp.id, tp.code, tp.status, tp.guest_name, tp.cnic_last4,
       to_json(tp.checked_in_at) #>> '{}' AS checked_in_at,
       to_json(tp.issued_at) #>> '{}' AS issued_at,
       tp.quantity_index,
       b.id AS booking_id, b.user_id AS booking_user_id,
       b.customer_name, b.customer_email, b.customer_phone,
       p.full_name AS buyer_full_name, p.phone AS buyer_phone,
       tt.name AS ticket_type_name, tt.price AS ticket_type_price
     FROM ticket_passes tp
     LEFT JOIN bookings b ON b.id = tp.booking_id
     LEFT JOIN profiles p ON p.id = b.user_id
     LEFT JOIN ticket_types tt ON tt.id = tp.ticket_type_id
     WHERE tp.event_id = $1
     ORDER BY tp.issued_at DESC`,
    [eventId],
  );

  const attendees = passes.map((pass) => ({
    id: Number(pass.id),
    code: pass.code,
    status: pass.status,
    guestName:
      pass.guest_name || pass.customer_name || pass.buyer_full_name || "Unknown",
    guestCnic: pass.cnic_last4 || null,
    guestCnicFormatted: pass.cnic_last4
      ? `*****-*******-${pass.cnic_last4.slice(0, 1)}`
      : null,
    ticketType: pass.ticket_type_name || "Standard",
    price: pass.ticket_type_price !== null ? Number(pass.ticket_type_price) : 0,
    checkedInAt: pass.checked_in_at,
    issuedAt: pass.issued_at,
    buyerEmail: pass.customer_email,
    buyerPhone: pass.customer_phone || pass.buyer_phone,
  }));

  const stats = {
    total: attendees.length,
    checkedIn: attendees.filter((a) => a.status === "checked_in").length,
    pending: attendees.filter((a) => a.status === "issued").length,
  };

  return ok({
    event: { id: Number(event.id), name: event.name },
    attendees,
    stats,
  });
});
