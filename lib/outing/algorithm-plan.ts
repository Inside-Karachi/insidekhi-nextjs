import { byRatingDesc, fetchListingCards } from "@/lib/outing/fetch-listings";
import {
  MAX_STOPS,
  MIN_STOPS,
  matchOutingTemplate,
  type OutingSlot,
} from "@/lib/outing/templates";
import type {
  MatchedPlanContext,
  OutingPlanResponse,
  OutingPlanStopDTO,
} from "@/lib/outing/types";
import type { ListingCardDTO } from "@/lib/mobile/mappers";

/** Resolve prompt into shared context for algorithm + AI. */
export function resolvePlanContext(prompt: string): MatchedPlanContext {
  const matched = matchOutingTemplate(prompt);
  return {
    normalized: matched.normalized,
    area: matched.area,
    template: matched.template,
    interpretation: matched.interpretation,
    slots: matched.template.slots.slice(0, MAX_STOPS),
  };
}

/**
 * Fetch the best unused listing for a slot (primary category, then fallbacks).
 */
export async function pickForSlot(
  slot: OutingSlot,
  area: string | null,
  used: Set<number>,
): Promise<ListingCardDTO | null> {
  const slugs = [slot.categorySlug, ...(slot.fallbackSlugs ?? [])];
  for (const slug of slugs) {
    const listings = await fetchListingCards({
      categorySlug: slug,
      search: area,
      limit: 12,
    });
    const pick = [...listings].sort(byRatingDesc).find((l) => !used.has(l.id));
    if (pick) return pick;
  }
  return null;
}

function roleReason(slot: OutingSlot): string {
  return `${slot.label} stop · top-rated in category`;
}

/**
 * Deterministic outing plan: vibe template → one listing per slot (2–3 stops).
 */
export async function buildAlgorithmOutingPlan(
  prompt: string,
): Promise<OutingPlanResponse> {
  const ctx = resolvePlanContext(prompt);
  const stops: OutingPlanStopDTO[] = [];
  const used = new Set<number>();

  for (const slot of ctx.slots) {
    if (stops.length >= MAX_STOPS) break;
    const listing = await pickForSlot(slot, ctx.area, used);
    if (!listing) continue;
    used.add(listing.id);
    stops.push({
      listing,
      role: slot.role,
      reason: roleReason(slot),
    });
  }

  // Pad to MIN_STOPS with broad restaurant search if slots starved.
  if (stops.length < MIN_STOPS) {
    const extra = await fetchListingCards({
      categorySlug: "restaurants-cafes",
      search: ctx.area,
      limit: 12,
    });
    for (const listing of [...extra].sort(byRatingDesc)) {
      if (used.has(listing.id)) continue;
      used.add(listing.id);
      stops.push({
        listing,
        role: "extra",
        reason: "Extra stop · top-rated restaurant",
      });
      if (stops.length >= MIN_STOPS) break;
    }
  }

  return {
    mode: "algorithm",
    interpretation: ctx.interpretation,
    stops: stops.slice(0, MAX_STOPS),
  };
}

/**
 * Balanced candidate pool for AI: ~8–10 listings per template slot.
 */
export async function buildCandidatePool(
  prompt: string,
  perSlot = 9,
): Promise<{
  ctx: MatchedPlanContext;
  candidates: ListingCardDTO[];
  /** Candidates grouped by slot role for fill-missing logic. */
  byRole: Map<string, ListingCardDTO[]>;
}> {
  const ctx = resolvePlanContext(prompt);
  const byId = new Map<number, ListingCardDTO>();
  const byRole = new Map<string, ListingCardDTO[]>();

  for (const slot of ctx.slots) {
    const roleList: ListingCardDTO[] = [];
    const slugs = [slot.categorySlug, ...(slot.fallbackSlugs ?? [])];
    for (const slug of slugs) {
      if (roleList.length >= perSlot) break;
      const listings = await fetchListingCards({
        categorySlug: slug,
        search: ctx.area,
        limit: perSlot,
      });
      for (const l of [...listings].sort(byRatingDesc)) {
        if (roleList.length >= perSlot) break;
        if (!byId.has(l.id)) byId.set(l.id, l);
        if (!roleList.some((x) => x.id === l.id)) roleList.push(l);
      }
    }
    byRole.set(slot.role, roleList);
  }

  // Soft floor: if pool is tiny, add city-wide restaurants.
  if (byId.size < 8) {
    const extra = await fetchListingCards({
      categorySlug: "restaurants-cafes",
      search: ctx.area,
      limit: 12,
    });
    for (const l of extra) {
      if (!byId.has(l.id)) byId.set(l.id, l);
    }
  }

  const candidates = [...byId.values()].sort(byRatingDesc);
  return { ctx, candidates, byRole };
}

/** @deprecated — use resolvePlanContext; kept for any stray imports. */
export function extractPromptSignals(prompt: string) {
  const ctx = resolvePlanContext(prompt);
  return {
    normalized: ctx.normalized,
    area: ctx.area,
    categorySlugs: ctx.slots.map((s) => s.categorySlug),
    matchedLabels: ctx.slots.map((s) => s.label),
  };
}
