import { query } from "@/lib/db";

export type AttendeePreview = { username: string | null; avatar_url: string | null };
export type AttendeesPreview = { users: AttendeePreview[]; total_count: number };

const PREVIEW_SIZE = 3;

/**
 * Batched "N people going" lookup for a page of event cards, derived from
 * paid ticket bookings — there's no separate RSVP/interested concept in this
 * schema, so "going" means "bought a ticket". One query for every event id on
 * the page avoids an N+1 per card. Identity is exposed as `username` (never
 * `full_name`), matching the ReviewDTO/CommentDTO author convention elsewhere
 * in the mobile contract (section 1.1.3 — handle, not real name).
 */
export async function getAttendeesPreviewByEvent(
  eventIds: number[],
): Promise<Map<number, AttendeesPreview>> {
  const result = new Map<number, AttendeesPreview>();
  if (eventIds.length === 0) return result;

  const { rows } = await query(
    `WITH attendee_bookings AS (
       SELECT event_id, user_id, MIN(created_at) AS first_booked_at
       FROM bookings
       WHERE event_id = ANY($1)
         AND payment_status = 'paid'
         AND status IN ('confirmed', 'completed')
       GROUP BY event_id, user_id
     ),
     ranked AS (
       SELECT
         ab.event_id,
         p.username,
         p.avatar_url,
         COUNT(*) OVER (PARTITION BY ab.event_id) AS total_count,
         ROW_NUMBER() OVER (
           PARTITION BY ab.event_id ORDER BY ab.first_booked_at ASC
         ) AS rn
       FROM attendee_bookings ab
       JOIN profiles p ON p.id = ab.user_id
     )
     SELECT event_id, username, avatar_url, total_count
     FROM ranked
     WHERE rn <= $2
     ORDER BY event_id, rn`,
    [eventIds, PREVIEW_SIZE],
  );

  for (const row of rows) {
    const eventId = Number(row.event_id);
    const user: AttendeePreview = {
      username: row.username ?? null,
      avatar_url: row.avatar_url ?? null,
    };
    const existing = result.get(eventId);
    if (existing) {
      existing.users.push(user);
    } else {
      result.set(eventId, { users: [user], total_count: Number(row.total_count) });
    }
  }

  return result;
}
