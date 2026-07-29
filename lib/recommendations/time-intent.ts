/**
 * Time-of-day / day-of-week category boosts, keyed by category **slug** (not
 * id - ids are duplicated across this repo and the RN app, and this table is
 * meant to be reviewable by a non-engineer). Every slug below was verified
 * against live published-listing counts (>=20) on 2026-07-29; slugs with
 * thinner inventory are deliberately left out so a boost never yields empty
 * rows (live-music-comedy-venues, gaming-lounges-arcades,
 * cinemas-amusement-parks, parks-outdoor-spaces, shopping-malls-outlets).
 */
import { query } from "@/lib/db";
import { RECS_TIMEZONE } from "./constants";

export type TimeBucket =
  | "earlyMorning" // 05-11
  | "lunch" // 11-15
  | "afternoon" // 15-17
  | "evening" // 17-20
  | "dinner" // 20-23
  | "lateNight"; // 23-05

export type DayClass = "weekday" | "friday" | "weekend";

export type TimeContext = {
  hour: number;
  bucket: TimeBucket;
  dayClass: DayClass;
  isSaturday: boolean;
  isSunday: boolean;
};

function bucketForHour(hour: number): TimeBucket {
  if (hour >= 23 || hour < 5) return "lateNight";
  if (hour < 11) return "earlyMorning";
  if (hour < 15) return "lunch";
  if (hour < 17) return "afternoon";
  if (hour < 20) return "evening";
  return "dinner";
}

/**
 * Reads the wall-clock hour/weekday in {@link RECS_TIMEZONE} without pulling
 * in a date library - `Intl` handles the IANA offset (incl. no-DST) for us.
 */
export function computeTimeContext(now: Date = new Date()): TimeContext {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RECS_TIMEZONE,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  // Intl can format midnight as "24" with hour12: false.
  const hour = Number(hourPart) % 24;

  const isSaturday = weekdayPart === "Sat";
  const isSunday = weekdayPart === "Sun";
  const isFriday = weekdayPart === "Fri";
  const dayClass: DayClass = isFriday
    ? "friday"
    : isSaturday || isSunday
      ? "weekend"
      : "weekday";

  return { hour, bucket: bucketForHour(hour), dayClass, isSaturday, isSunday };
}

const DAYTIME_BUCKETS = new Set<TimeBucket>(["earlyMorning", "lunch", "afternoon"]);

type BoostRule = {
  match: (ctx: TimeContext) => boolean;
  boosts: Record<string, number>;
};

const RULES: BoostRule[] = [
  {
    // weekday lunch
    match: (ctx) => ctx.dayClass === "weekday" && ctx.bucket === "lunch",
    boosts: {
      "restaurants-cafes": 1.0,
      "fast-food-street-food": 0.9,
      "cafes-coworking-spots": 0.9,
      "pakistani-desi-cuisine": 0.8,
    },
  },
  {
    // weekday early morning
    match: (ctx) => ctx.dayClass === "weekday" && ctx.bucket === "earlyMorning",
    boosts: {
      "cafes-coworking-spots": 0.9,
      "gyms-fitness-centers": 0.9,
      "juice-bars-beverages": 0.8,
    },
  },
  {
    // weekday 09:00-17:00 (business hours), independent of the bucket grid above
    match: (ctx) => ctx.dayClass === "weekday" && ctx.hour >= 9 && ctx.hour < 17,
    boosts: {
      "professional-business-services": 0.7,
      "clinics-hospitals": 0.6,
      "diagnostic-labs-imaging": 0.6,
      "colleges-universities-institutes": 0.6,
    },
  },
  {
    // weekday evening
    match: (ctx) => ctx.dayClass === "weekday" && ctx.bucket === "evening",
    boosts: {
      "salons-spas": 0.7,
      "gyms-fitness-centers": 0.8,
      "barbershops-mens-grooming": 0.7,
    },
  },
  {
    // Friday/Saturday dinner + late night
    match: (ctx) =>
      (ctx.dayClass === "friday" || ctx.isSaturday) &&
      (ctx.bucket === "dinner" || ctx.bucket === "lateNight"),
    boosts: {
      "pakistani-desi-cuisine": 1.0,
      "bakeries-desserts": 0.85,
      "fine-dining-buffets": 0.8,
      "entertainment-recreation": 0.9,
      "padel-cricket-futsal-clubs": 0.7,
    },
  },
  {
    // weekend daytime
    match: (ctx) => ctx.dayClass === "weekend" && DAYTIME_BUCKETS.has(ctx.bucket),
    boosts: {
      "entertainment-recreation": 0.85,
      "travel-tourism": 0.8,
      "apparel-clothing": 0.7,
      "groceries-fresh-food": 0.6,
    },
  },
  {
    // Sunday evening
    match: (ctx) => ctx.isSunday && ctx.bucket === "evening",
    boosts: {
      "salons-spas": 0.8,
      "cosmetics-fragrances": 0.7,
    },
  },
  {
    // any late night
    match: (ctx) => ctx.bucket === "lateNight",
    boosts: {
      "pakistani-desi-cuisine": 1.0,
      "fast-food-street-food": 0.9,
      "pharmacies-medical-stores": 0.6,
    },
  },
];

/** Floor for slugs with no matching rule right now - nothing is ever zeroed. */
export const TIME_INTENT_FLOOR = 0.25;

/**
 * Pure (no DB) - combines every matching rule via max-per-slug. Slugs absent
 * from the result should be read as {@link TIME_INTENT_FLOOR} by the caller.
 */
export function getTimeIntentBoostsBySlug(
  now: Date = new Date(),
): Record<string, number> {
  const ctx = computeTimeContext(now);
  const merged: Record<string, number> = {};
  for (const rule of RULES) {
    if (!rule.match(ctx)) continue;
    for (const [slug, value] of Object.entries(rule.boosts)) {
      merged[slug] = Math.max(merged[slug] ?? 0, value);
    }
  }
  return merged;
}

let categorySlugIdCache: Promise<Map<string, number>> | null = null;

/** Process-lifetime cache of slug -> category id, resolved once per process. */
export function getCategorySlugIdMap(): Promise<Map<string, number>> {
  if (!categorySlugIdCache) {
    categorySlugIdCache = query(`SELECT id, slug FROM categories`)
      .then(
        ({ rows }) =>
          new Map(
            (rows as Array<{ id: number | string; slug: string }>).map((r) => [
              r.slug,
              Number(r.id),
            ]),
          ),
      )
      .catch((error) => {
        // Allow the next call to retry instead of caching a permanent failure.
        categorySlugIdCache = null;
        throw error;
      });
  }
  return categorySlugIdCache;
}

/**
 * Time-of-day boosts keyed by category id (DB round-trip on first call per
 * process, then cached). Unknown/unmapped category ids should read as
 * {@link TIME_INTENT_FLOOR} by the caller.
 */
export async function getTimeIntentBoostsByCategoryId(
  now: Date = new Date(),
): Promise<Map<number, number>> {
  const [bySlug, slugToId] = await Promise.all([
    Promise.resolve(getTimeIntentBoostsBySlug(now)),
    getCategorySlugIdMap(),
  ]);
  const byId = new Map<number, number>();
  for (const [slug, value] of Object.entries(bySlug)) {
    const id = slugToId.get(slug);
    if (id != null) byId.set(id, value);
  }
  return byId;
}
