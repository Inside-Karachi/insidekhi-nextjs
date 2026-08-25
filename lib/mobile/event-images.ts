import { query } from "@/lib/db";

/**
 * Batch-loads each event's primary (or first, by display order) image from
 * `event_images`, keyed by event_id. Used by event list endpoints that render
 * an EventCard thumbnail without paying for a full per-event gallery fetch.
 */
export async function fetchPrimaryImagesByEventId(
  eventIds: number[],
): Promise<Map<number, string>> {
  if (eventIds.length === 0) return new Map();

  const { rows } = await query(
    `SELECT DISTINCT ON (event_id) event_id, url
     FROM event_images
     WHERE event_id = ANY($1)
     ORDER BY event_id, is_primary DESC NULLS LAST, display_order ASC NULLS LAST`,
    [eventIds],
  );

  return new Map(rows.map((row) => [Number(row.event_id), row.url as string]));
}
