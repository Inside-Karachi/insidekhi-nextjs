import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  EVENT_CARD_COLUMNS,
  toEventCard,
  type EventCardRow,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/events
 *
 * Public, paginated list of upcoming/ongoing published events (those whose
 * `end_time >= now`), ordered by `start_time` (featured first when `?featured`).
 * Mirrors the website's `app/api/events` handler, normalized into the mobile
 * envelope. Published-only - `event_status` is enforced here and by anon RLS.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const supabase = createMobilePublicClient();
  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 12,
    maxLimit: 100,
  });

  const rawSearch = searchParams.get("search");
  const search =
    rawSearch && rawSearch.trim() ? sanitizeSearchTerm(rawSearch) : "";
  const rawLocation = searchParams.get("location");
  const location =
    rawLocation && rawLocation.trim() ? sanitizeSearchTerm(rawLocation) : "";
  const date = searchParams.get("date");
  const featured = searchParams.get("featured") === "true";

  let query = supabase
    .from("events_with_details")
    .select(EVENT_CARD_COLUMNS, { count: "exact" })
    .eq("event_status", "published")
    .gte("end_time", new Date().toISOString());

  if (featured) {
    query = query
      .eq("is_featured", true)
      .order("featured_rank", { ascending: false, nullsFirst: false });
  }

  query = query
    .order("start_time", { ascending: true })
    .order("event_id", { ascending: true });

  if (search) {
    query = query.ilike("event_name", `%${search}%`);
  }

  if (location) {
    query = query.ilike("address", `%${location}%`);
  }

  if (date) {
    // Day boundaries are Asia/Karachi (UTC+5) per the v1 contract, not UTC -
    // anchor the parsed YYYY-MM-DD to Karachi midnight before forming the range.
    const filterDate = new Date(`${date}T00:00:00+05:00`);
    if (!Number.isNaN(filterDate.getTime())) {
      const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
      query = query
        .gte("start_time", filterDate.toISOString())
        .lt("start_time", nextDay.toISOString());
    }
  }

  const { data, count, error } = await query
    .returns<EventCardRow[]>()
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[mobile-api] events query failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load events.", 500);
  }

  const events = (data ?? []).map(toEventCard);

  return ok(events, {
    pagination: buildPaginationMeta(page, limit, count ?? 0),
  });
});
