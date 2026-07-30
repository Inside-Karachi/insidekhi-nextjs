import "dotenv/config";
import { query } from "../lib/db";

type MatchRule = {
  slug: string;
  keywords: string[];
};

const RULES: MatchRule[] = [
  // Fitness & Sports (Parent 104)
  {
    slug: "gyms-fitness-centers",
    keywords: [
      "gym",
      "fitness",
      "workout",
      "bodybuilding",
      "weightlifting",
      "crossfit",
      "health club",
      "fitness center",
      "fitness centre",
    ],
  },
  {
    slug: "padel-cricket-futsal-clubs",
    keywords: [
      "padel",
      "futsal",
      "cricket ground",
      "turf",
      "football ground",
      "sports club",
      "badminton court",
      "sports complex",
    ],
  },
  {
    slug: "swimming-pools-clubs",
    keywords: [
      "swimming pool",
      "swimming club",
      "water park",
      "pool club",
      "aqua club",
    ],
  },
  {
    slug: "yoga-martial-arts-studios",
    keywords: [
      "yoga",
      "martial arts",
      "karate",
      "taekwondo",
      "judo",
      "mma",
      "boxing club",
      "pilates",
    ],
  },

  // Food & Dining (Parent 75)
  {
    slug: "cafes-coworking-spots",
    keywords: [
      "cafe",
      "café",
      "coffee",
      "espresso",
      "coworking",
      "co-working",
      "work space",
      "roastery",
    ],
  },
  {
    slug: "fine-dining-buffets",
    keywords: [
      "fine dining",
      "buffet",
      "churrascaria",
      "steakhouse",
      "hi-tea",
      "hitech",
      "luxury dining",
    ],
  },
  {
    slug: "catering-home-based-cooks",
    keywords: [
      "catering",
      "caterer",
      "home chef",
      "home cook",
      "tiffin",
      "home kitchen",
    ],
  },
  {
    slug: "juice-bars-beverages",
    keywords: [
      "juice",
      "smoothie",
      "shake",
      "beverage",
      "tea stall",
      "chai",
      "boba",
      "bubble tea",
    ],
  },

  // Shopping & Fashion (Parent 76)
  {
    slug: "kids-baby-products",
    keywords: [
      "baby",
      "kids shop",
      "toy shop",
      "toys",
      "nursery",
      "children wear",
      "mothercare",
      "junior",
    ],
  },
  {
    slug: "second-hand-thrift",
    keywords: [
      "thrift",
      "second hand",
      "pre-loved",
      "preloved",
      "vintage shop",
      "flea market",
    ],
  },
  {
    slug: "sports-outdoor-gear",
    keywords: [
      "sports shop",
      "sports goods",
      "outdoor gear",
      "bicycle shop",
      "cycle shop",
      "fitness equipment",
    ],
  },
  {
    slug: "gift-shops-novelties",
    keywords: [
      "gift shop",
      "novelty",
      "souvenir",
      "flower shop",
      "florist",
      "greeting cards",
    ],
  },

  // Health & Wellness (Parent 77)
  {
    slug: "diagnostic-labs-imaging",
    keywords: [
      "diagnostic",
      "lab",
      "laboratory",
      "x-ray",
      "ultrasound",
      "mri scan",
      "ct scan",
      "chughtai lab",
      "dow lab",
      "blood test",
    ],
  },
  {
    slug: "mental-health-therapy",
    keywords: [
      "psychiatrist",
      "psychologist",
      "therapy center",
      "counseling",
      "mental health",
      "psychotherapy",
    ],
  },
  {
    slug: "physiotherapy-rehab",
    keywords: [
      "physiotherapy",
      "physio",
      "rehabilitation center",
      "chiropractor",
      "physical therapy",
    ],
  },
  {
    slug: "nutritionists-dieticians",
    keywords: [
      "nutritionist",
      "dietitian",
      "dietician",
      "weight loss clinic",
    ],
  },

  // Beauty & Personal Care (Parent 78)
  {
    slug: "barbershops-mens-grooming",
    keywords: [
      "barber",
      "barbershop",
      "men's salon",
      "mens salon",
      "men grooming",
      "gents salon",
    ],
  },
  {
    slug: "nail-studios",
    keywords: ["nail studio", "nail bar", "manicure", "pedicure", "nail art"],
  },
  {
    slug: "tattoo-piercing-studios",
    keywords: ["tattoo", "piercing", "body art"],
  },

  // Services & Living (Parent 79)
  {
    slug: "home-services-repairs",
    keywords: [
      "plumber",
      "electrician",
      "carpenter",
      "ac repair",
      "appliance repair",
      "handyman",
    ],
  },
  {
    slug: "event-planning-catering",
    keywords: [
      "event planner",
      "event management",
      "wedding planner",
      "stage decor",
      "decorator",
    ],
  },
  {
    slug: "cleaning-maintenance",
    keywords: [
      "cleaning service",
      "janitorial",
      "car wash",
      "laundry",
      "dry cleaner",
      "pest control",
    ],
  },
  {
    slug: "legal-financial-services",
    keywords: [
      "lawyer",
      "legal services",
      "advocate",
      "accounting firm",
      "tax consultant",
      "auditor",
    ],
  },
  {
    slug: "it-tech-support",
    keywords: [
      "computer repair",
      "software house",
      "web development",
      "it support",
      "laptop repair",
    ],
  },
  {
    slug: "pet-care-veterinary",
    keywords: [
      "vet clinic",
      "veterinary",
      "pet shop",
      "pet care",
      "dog clinic",
      "animal hospital",
    ],
  },
  {
    slug: "printing-photography-studios",
    keywords: [
      "printing press",
      "flex printing",
      "photographer",
      "photo studio",
      "videography",
    ],
  },

  // Education & Learning (Parent 80)
  {
    slug: "tutoring-coaching-centers",
    keywords: [
      "coaching center",
      "coaching centre",
      "tutor",
      "tuition academy",
      "coaching academy",
    ],
  },
  {
    slug: "skill-vocational-training",
    keywords: [
      "vocational institute",
      "technical institute",
      "skill development",
      "computer academy",
      "driving school",
    ],
  },
  {
    slug: "language-learning-centers",
    keywords: [
      "language institute",
      "english learning",
      "german language",
      "french learning",
    ],
  },
  {
    slug: "test-prep",
    keywords: [
      "sat prep",
      "ielts prep",
      "mdcat prep",
      "ecat prep",
      "entry test prep",
    ],
  },

  // Entertainment & Recreation (Parent 99)
  {
    slug: "cinemas-amusement-parks",
    keywords: [
      "cinema",
      "multiplex",
      "movie theater",
      "amusement park",
      "joyland",
    ],
  },
  {
    slug: "parks-outdoor-spaces",
    keywords: ["public park", "family park", "botanical garden", "playground"],
  },
  {
    slug: "gaming-lounges-arcades",
    keywords: [
      "gaming lounge",
      "game lounge",
      "ps5 lounge",
      "playstation",
      "arcade",
      "vr lounge",
    ],
  },
  {
    slug: "live-music-comedy-venues",
    keywords: [
      "live music",
      "comedy club",
      "standup comedy",
      "theatre venue",
    ],
  },
];

async function main() {
  console.log("Fetching categories from database...");
  const { rows: catRows } = await query(
    `SELECT id, slug, name, parent_id FROM categories WHERE parent_id IS NOT NULL`
  );

  const slugToCategory = new Map<
    string,
    { id: number; name: string; parent_id: number }
  >();
  for (const row of catRows) {
    slugToCategory.set(row.slug, {
      id: parseInt(row.id, 10),
      name: row.name,
      parent_id: parseInt(row.parent_id, 10),
    });
  }

  console.log(`Loaded ${slugToCategory.size} subcategories.`);

  console.log("Fetching listings from database...");
  const { rows: listings } = await query(
    `SELECT id, name, description, category_id FROM listings`
  );
  console.log(`Analyzing ${listings.length} listings...`);

  type InsertTuple = { listingId: number; categoryId: number; isPrimary: boolean };
  const toInsert: InsertTuple[] = [];
  const matchesBySubcategory: Record<string, number> = {};

  for (const listing of listings) {
    const listingId = parseInt(listing.id, 10);
    const textToMatch = `${listing.name || ""} ${
      listing.description || ""
    }`.toLowerCase();

    for (const rule of RULES) {
      const cat = slugToCategory.get(rule.slug);
      if (!cat) continue;

      const isMatch = rule.keywords.some((kw) => textToMatch.includes(kw));

      if (isMatch) {
        matchesBySubcategory[cat.name] =
          (matchesBySubcategory[cat.name] || 0) + 1;

        const hasPrimary = listing.category_id != null;
        const isPrimary = !hasPrimary;

        toInsert.push({
          listingId,
          categoryId: cat.id,
          isPrimary,
        });
      }
    }
  }

  console.log(`Found ${toInsert.length} total matches. Performing bulk insert...`);

  // Bulk insert in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const valueTuples: string[] = [];

    chunk.forEach((item, index) => {
      const offset = index * 3;
      valueTuples.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
      values.push(item.listingId, item.categoryId, item.isPrimary);
    });

    await query(
      `INSERT INTO listing_categories (listing_id, category_id, is_primary)
       VALUES ${valueTuples.join(", ")}
       ON CONFLICT (listing_id, category_id) DO NOTHING`,
      values
    );
  }

  console.log("\n=================================");
  console.log(`Classification complete!`);
  console.log(`Total new category links created: ${toInsert.length}`);
  console.log("Breakdown by subcategory:");
  console.log(JSON.stringify(matchesBySubcategory, null, 2));
  console.log("=================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Classification error:", err);
  process.exit(1);
});
