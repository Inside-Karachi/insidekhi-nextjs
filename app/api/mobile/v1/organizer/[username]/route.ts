import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/organizer/{username}  (public, unauthenticated)
 *
 * An organizer's public profile: safe profile fields (never email, role,
 * points, or any other private column) plus their published events (with
 * images) and a total-attendees count. Mirrors what
 * `OrganizerPublicProfile`/`EventCard` in the app expect.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const username = (await params).username;

  if (!username || typeof username !== "string") {
    throw new MobileApiError("validation_error", "A username is required.", 400);
  }

  const { rows: profileRows } = await query(
    `SELECT id, full_name, username, avatar_url, organizer_bio, organizer_company,
            organizer_website, is_verified_organizer, phone
     FROM profiles
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username],
  );
  const organizer = profileRows[0];
  if (!organizer) {
    throw new MobileApiError("not_found", "Organizer not found.", 404);
  }

  const { rows: eventRows } = await query(
    `SELECT id, name, slug, start_time, end_time, location_name
     FROM events
     WHERE organizer_id = $1 AND status = 'published'
     ORDER BY start_time DESC`,
    [organizer.id],
  );
  const eventIds = eventRows.map((e) => e.id);

  const imagesByEvent: Record<number, { url: string; is_primary: boolean }[]> = {};
  if (eventIds.length > 0) {
    const { rows: imageRows } = await query(
      `SELECT event_id, url, is_primary
       FROM event_images
       WHERE event_id = ANY($1::bigint[])
       ORDER BY display_order ASC`,
      [eventIds],
    );
    for (const img of imageRows) {
      const eventId = Number(img.event_id);
      (imagesByEvent[eventId] ??= []).push({
        url: img.url,
        is_primary: img.is_primary ?? false,
      });
    }
  }

  let totalAttendees = 0;
  if (eventIds.length > 0) {
    const { rows: attendeeRows } = await query(
      `SELECT COUNT(*) AS count
       FROM ticket_passes tp
       JOIN bookings b ON b.id = tp.booking_id
       WHERE b.event_id = ANY($1::bigint[]) AND b.payment_status = 'paid'`,
      [eventIds],
    );
    totalAttendees = parseInt(attendeeRows[0]?.count ?? "0", 10) || 0;
  }

  const events = eventRows.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    start_time: e.start_time,
    end_time: e.end_time,
    location_name: e.location_name,
    images: imagesByEvent[e.id] ?? [],
  }));

  return ok({
    organizer: {
      id: organizer.id,
      full_name: organizer.full_name,
      username: organizer.username,
      avatar_url: organizer.avatar_url,
      organizer_bio: organizer.organizer_bio,
      organizer_company: organizer.organizer_company,
      organizer_website: organizer.organizer_website,
      is_verified_organizer: organizer.is_verified_organizer,
      phone: organizer.phone,
    },
    events,
    total_attendees: totalAttendees,
  });
});
