import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { MobileErrors } from "@/lib/mobile/errors";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { query } from "@/lib/db";
import {
  toListingCard,
  toListingImage,
  toNumericListingRow,
  LISTING_CARD_COLUMNS,
  type ListingCardDTO,
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";
import { getRecommendationCandidates } from "@/lib/recommendations/candidates";
import { diversify } from "@/lib/recommendations/scoring";
import { getDiscoveryIntent } from "@/lib/discovery/intents";
import {
  resolveIntentCategoryFilter,
  passesIntentFilters,
  scoreDiscoveryCandidates,
  type DiscoveryCandidateInput,
  type ScoredDiscoveryCandidate,
} from "@/lib/discovery/scoring";
import { getUpcomingEventCards } from "@/lib/discovery/events";

export const dynamic = "force-dynamic";

// A larger pool than "Recommended For You" (150): intents filter the pool
// down further by category/hours/distance before ranking, so a bit more
// headroom avoids thin results for narrower intents (One Hour Free, Late
// Night) without materially changing query cost - it's the same shape of
// query candidates.ts already runs, just LIMIT 200 instead of 150.
const DISCOVERY_POOL_SIZE = 200;
const EVENTS_LIMIT = 3;

// Same Karachi bounding box used by GET /user/recommendations.
const LAT_BOUNDS = { min: 24.7, max: 25.0 };
const LNG_BOUNDS = { min: 66.9, max: 67.4 };

function parseCoord(raw: string | null, bounds: { min: number; max: number }): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < bounds.min || n > bounds.max) return null;
  return n;
}

function isAdmin(role?: string): boolean {
  return role === "admin" || role === "super_admin";
}

type DiscoveryListingCardDTO = ListingCardDTO & {
  discovery: {
    reason: string;
    score?: number;
    breakdown?: ScoredDiscoveryCandidate["breakdown"];
  };
};

function buildDiscoveryReason(candidate: ScoredDiscoveryCandidate): string {
  const parts: string[] = [];
  if (candidate.openState === "open") parts.push("Open now");
  else if (candidate.openState === "closed") parts.push("Closed now");

  if (candidate.distanceMeters != null) {
    const km = candidate.distanceMeters / 1000;
    parts.push(km < 1 ? `${Math.round(candidate.distanceMeters)} m away` : `${km.toFixed(1)} km away`);
  }
  if (candidate.minPricePerPerson != null) {
    parts.push(`~Rs ${Math.round(candidate.minPricePerPerson)}/person`);
  }
  return parts.join(" · ");
}

/**
 * GET /api/mobile/v1/discovery/intents/{slug}
 *
 * Ranked listings for one Discovery Intent - "what should I do right now"
 * for the chosen mood (Date Night, Late Night, ...), as opposed to browsing
 * a category. Reuses the exact candidate pool "Recommended For You" gathers
 * (lib/recommendations/candidates.ts: geo-sorted when coords are known,
 * published + has-image + has-category only), then applies this intent's
 * own filter + weighted scorer (lib/discovery/scoring.ts) instead of the
 * affinity-based "Recommended For You" blend, and the same MMR diversity
 * re-rank (lib/recommendations/scoring.ts's diversify) so one dominant
 * category can't fill the whole feed.
 *
 * Auth is optional, same reasoning as GET /user/recommendations: geo + time
 * + open-now needs no account, and requiring one would silently drop
 * signed-out users on a token expiry. Signed-out callers are identified by
 * `X-Anon-Id` (used only to seed the anti-staleness jitter here - unlike
 * /user/recommendations, intents do not use learned per-user affinity).
 *
 * Query params: `lat`/`lng` (falls back to the caller's active saved
 * location, then time-of-day/freshness only), `page`/`limit`
 * (default 10, max 30). `?debug=1` (admin only) adds a per-term score
 * breakdown to each card's `discovery` field.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  const { slug } = await params;
  const config = getDiscoveryIntent(slug);
  if (!config) throw MobileErrors.notFound("Unknown discovery intent.");

  const { user } = await getOptionalMobileUser(request);
  await enforceMobileRateLimit(request, user?.id);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 30,
  });
  const debug = searchParams.get("debug") === "1" && isAdmin(user?.role);
  const anonId = request.headers.get("x-anon-id");

  let lat = parseCoord(searchParams.get("lat"), LAT_BOUNDS);
  let lng = parseCoord(searchParams.get("lng"), LNG_BOUNDS);

  if ((lat == null || lng == null) && user) {
    const { rows } = await query(
      `SELECT latitude, longitude FROM public.user_saved_locations
       WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [user.id],
    );
    const active = rows[0];
    if (active) {
      lat = Number(active.latitude);
      lng = Number(active.longitude);
    }
  }

  const now = new Date();

  const [candidates, filter] = await Promise.all([
    getRecommendationCandidates({ lat, lng, now, poolSize: DISCOVERY_POOL_SIZE }),
    resolveIntentCategoryFilter(config),
  ]);

  const eligible: DiscoveryCandidateInput[] = candidates.filter((c) =>
    passesIntentFilters(c, config, filter),
  );

  // Budget Friendly is the only intent with a non-zero price weight - skip
  // the extra query entirely for the other seven.
  let priced: DiscoveryCandidateInput[] = eligible;
  if (config.weights.price > 0 && eligible.length > 0) {
    const ids = eligible.map((c) => c.id);
    const { rows } = await query(
      `SELECT id, min_price_per_person FROM listings WHERE id = ANY($1::int[])`,
      [ids],
    );
    const priceByListing = new Map<number, number | null>(
      (rows as Array<{ id: number | string; min_price_per_person: number | string | null }>).map((row) => [
        Number(row.id),
        row.min_price_per_person != null ? Number(row.min_price_per_person) : null,
      ]),
    );
    priced = eligible.map((c) => ({ ...c, minPricePerPerson: priceByListing.get(c.id) ?? null }));
  }

  const actorKey = user?.id ?? anonId ?? "anon";
  const scored = scoreDiscoveryCandidates(priced, config, filter, { now, actorKey });

  // Diversify only as deep as this page needs - the MMR re-rank is prefix-
  // stable (the same greedy choices produce page 1 whether you ask for 10
  // or the full pool), so this is equivalent to diversifying everything and
  // slicing, just cheaper for the common one-page case.
  const ranked = diversify(scored, offset + limit);
  const pageSlice = ranked.slice(offset, offset + limit);
  const orderedIds = pageSlice.map((c) => c.id);

  let listings: DiscoveryListingCardDTO[] = [];
  if (orderedIds.length > 0) {
    const [{ rows: cardRows }, { rows: imageRows }] = await Promise.all([
      query(`SELECT ${LISTING_CARD_COLUMNS} FROM listings_with_details WHERE id = ANY($1::int[])`, [orderedIds]),
      query(
        `SELECT id, listing_id, url, alt_text, display_order, is_primary
         FROM listing_images WHERE listing_id = ANY($1::int[])
         ORDER BY display_order ASC`,
        [orderedIds],
      ),
    ]);

    const byId = new Map<number, ListingRowLike>();
    for (const row of cardRows) {
      const normalized = toNumericListingRow(row);
      byId.set(normalized.id as number, normalized);
    }
    const imagesByListing: Record<number, ListingImageDTO[]> = {};
    for (const img of imageRows) {
      (imagesByListing[img.listing_id] ??= []).push(toListingImage(img));
    }
    const scoredById = new Map(pageSlice.map((c) => [c.id, c]));

    listings = orderedIds
      .map((id) => byId.get(id))
      .filter((row): row is ListingRowLike => row !== undefined)
      .map((row) => {
        const card = toListingCard(row, imagesByListing[row.id as number] ?? []);
        const scoredCandidate = scoredById.get(row.id as number)!;
        return {
          ...card,
          discovery: {
            reason: buildDiscoveryReason(scoredCandidate),
            ...(debug
              ? { score: scoredCandidate.score, breakdown: scoredCandidate.breakdown }
              : {}),
          },
        };
      });
  }

  const events = config.includeEvents ? await getUpcomingEventCards(EVENTS_LIMIT) : undefined;

  const reason =
    eligible.length === 0
      ? "Nothing matches this intent right now - try again later or widen your area."
      : lat != null && lng != null
        ? "Based on your location and time of day"
        : "Based on time of day";

  return ok(listings, {
    intent: { slug: config.slug, label: config.label, subtitle: config.subtitle },
    pagination: buildPaginationMeta(page, limit, eligible.length),
    reason,
    ...(events !== undefined ? { events } : {}),
  });
});
