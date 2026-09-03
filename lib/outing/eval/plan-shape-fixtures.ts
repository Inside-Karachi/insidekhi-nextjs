/**
 * Layer 2: planner shape checks with fixture candidates (no DB).
 * Ensures excludeFood / budget hard filters never pad with restaurants.
 */
import { extractOutingIntent } from "@/lib/outing/intent";
import { filterCandidates } from "@/lib/outing/algorithm-plan";
import type { OutingListingCard } from "@/lib/outing/fetch-listings";
import {
  assertPlanMatchesFixture,
  type IntentAssertFailure,
} from "@/lib/outing/eval/assert-intent";
import { coreGoldenPrompts } from "@/lib/outing/eval/golden-prompts";

const FIXTURE_POOL: OutingListingCard[] = [
  {
    id: 1,
    name: "Galaxy Bowling",
    slug: "galaxy-bowling",
    description: "Bowling lanes and arcade",
    address: "Clifton",
    category_id: 1,
    category_name: "Gaming Lounges & Arcades",
    latitude: null,
    longitude: null,
    avg_rating: 4.5,
    review_count: 20,
    is_featured: false,
    status: "published",
    menu_pdf_url: null,
    google_maps_url: null,
    images: [],
    category_slug: "gaming-lounges-arcades",
    min_price_per_person: 1500,
    max_price_per_person: 2500,
    min_guest_capacity: 2,
    max_guest_capacity: 20,
  },
  {
    id: 2,
    name: "Night Lounge",
    slug: "night-lounge",
    description: "Late hangout spot with live DJs",
    address: "DHA",
    category_id: 2,
    category_name: "Entertainment & Recreation",
    latitude: null,
    longitude: null,
    avg_rating: 4.3,
    review_count: 40,
    is_featured: false,
    status: "published",
    menu_pdf_url: null,
    google_maps_url: null,
    images: [],
    category_slug: "entertainment-recreation",
    min_price_per_person: null,
    max_price_per_person: null,
    min_guest_capacity: null,
    max_guest_capacity: null,
  },
  {
    id: 3,
    name: "Posh Table",
    slug: "posh-table",
    description: "Intimate fine dining",
    address: "Zamzama",
    category_id: 3,
    category_name: "Fine Dining & Buffets",
    latitude: null,
    longitude: null,
    avg_rating: 4.7,
    review_count: 80,
    is_featured: true,
    status: "published",
    menu_pdf_url: null,
    google_maps_url: null,
    images: [],
    category_slug: "fine-dining-buffets",
    min_price_per_person: 4000,
    max_price_per_person: 7000,
    min_guest_capacity: 2,
    max_guest_capacity: 8,
  },
  {
    id: 4,
    name: "Budget Biryani House",
    slug: "budget-biryani",
    description: "Famous biryani",
    address: "Burns Road",
    category_id: 4,
    category_name: "Pakistani & Desi Cuisine",
    latitude: null,
    longitude: null,
    avg_rating: 4.6,
    review_count: 200,
    is_featured: false,
    status: "published",
    menu_pdf_url: null,
    google_maps_url: null,
    images: [],
    category_slug: "pakistani-desi-cuisine",
    min_price_per_person: 800,
    max_price_per_person: 1200,
    min_guest_capacity: 1,
    max_guest_capacity: 40,
  },
  {
    id: 5,
    name: "Street Burger",
    slug: "street-burger",
    description: "Fast food burgers",
    address: "Saddar",
    category_id: 5,
    category_name: "Fast Food & Street Food",
    latitude: null,
    longitude: null,
    avg_rating: 4.1,
    review_count: 50,
    is_featured: false,
    status: "published",
    menu_pdf_url: null,
    google_maps_url: null,
    images: [],
    category_slug: "fast-food-street-food",
    min_price_per_person: 500,
    max_price_per_person: 900,
    min_guest_capacity: 1,
    max_guest_capacity: 30,
  },
  {
    id: 6,
    name: "Overpriced Palace",
    slug: "overpriced-palace",
    description: "Luxury tasting menu",
    address: "Clifton",
    category_id: 6,
    category_name: "Fine Dining & Buffets",
    latitude: null,
    longitude: null,
    avg_rating: 4.9,
    review_count: 15,
    is_featured: true,
    status: "published",
    menu_pdf_url: null,
    google_maps_url: null,
    images: [],
    category_slug: "fine-dining-buffets",
    min_price_per_person: 15000,
    max_price_per_person: 20000,
    min_guest_capacity: 2,
    max_guest_capacity: 6,
  },
  {
    id: 7,
    name: "Draft Venue",
    slug: "draft-venue",
    description: "Unpublished bowling",
    address: "Korangi",
    category_id: 7,
    category_name: "Entertainment & Recreation",
    latitude: null,
    longitude: null,
    avg_rating: 5,
    review_count: 1,
    is_featured: false,
    status: "draft",
    menu_pdf_url: null,
    google_maps_url: null,
    images: [],
    category_slug: "entertainment-recreation",
    min_price_per_person: 1000,
    max_price_per_person: 1000,
    min_guest_capacity: 2,
    max_guest_capacity: 10,
  },
];

/** Run layer-2 plan shape assertions for core golden prompts. */
export function runPlanShapeAssertions(): IntentAssertFailure[] {
  let failures: IntentAssertFailure[] = [];

  for (const fixture of coreGoldenPrompts()) {
    const intent = extractOutingIntent(fixture.prompt);
    const filtered = filterCandidates(FIXTURE_POOL, intent).sort((a, b) => {
      // Prefer activity keyword matches then rating — mirrors places ranker.
      const aKw = intent.activityKeywords.some((k) =>
        `${a.name} ${a.description}`.toLowerCase().includes(k.toLowerCase()),
      )
        ? 1
        : 0;
      const bKw = intent.activityKeywords.some((k) =>
        `${b.name} ${b.description}`.toLowerCase().includes(k.toLowerCase()),
      )
        ? 1
        : 0;
      if (bKw !== aKw) return bKw - aKw;
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    });

    if (intent.excludeFood) {
      const foodHit = filtered.find((l) =>
        /restaurant|biryani|burger|fine dining|fast food|pakistani/i.test(
          `${l.category_name} ${l.category_slug}`,
        ),
      );
      if (foodHit) {
        failures.push({
          fixtureId: fixture.id,
          prompt: fixture.prompt,
          message: `filterCandidates leaked food listing "${foodHit.name}"`,
        });
      }
    }

    if (intent.budgetMaxPkr != null) {
      const party = intent.partySize ?? 2;
      for (const l of filtered) {
        if (
          l.min_price_per_person != null &&
          l.min_price_per_person * party > intent.budgetMaxPkr
        ) {
          failures.push({
            fixtureId: fixture.id,
            prompt: fixture.prompt,
            message: `filterCandidates kept over-budget "${l.name}"`,
          });
        }
      }
    }

    // Mirror selectPlaces: food-first may list many restaurants; others max 1 food.
    const picks: typeof filtered = [];
    if (intent.primaryNeed === "food") {
      picks.push(...filtered.slice(0, 5));
    } else {
      let foodCount = 0;
      for (const listing of filtered) {
        if (picks.length >= 5) break;
        const isFood =
          /restaurant|biryani|burger|fine dining|fast food|pakistani|bakery|cafe/i.test(
            `${listing.category_name} ${listing.category_slug}`,
          );
        if (isFood) {
          if (foodCount >= 1) continue;
          foodCount += 1;
        }
        picks.push(listing);
      }
    }

    const stops = picks.map((listing) => ({
      role: "place" as const,
      listing,
    }));

    failures = failures.concat(
      assertPlanMatchesFixture(fixture, intent, stops),
    );
  }

  return failures;
}
