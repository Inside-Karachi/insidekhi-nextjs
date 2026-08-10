import "dotenv/config";
import { query } from "../lib/db";

const HOTEL_KEYWORDS = [
  "hotel",
  "guest house",
  "guesthouse",
  "resort",
  "lodging",
  "inn",
  "hostel",
  "suites",
  "motel",
  "farmhouse",
  "homestay",
  "bed & breakfast",
  "b&b",
];

// Exclusion terms for non-accommodation listings that happen to contain "hotel" or "inn"
const EXCLUSIONS = [
  "quetta",
  "chai",
  "tea stall",
  "broast",
  "tikka",
  "karahi",
  "biryani",
  "food",
  "dhaba",
  "fast food",
  "restaurant",
  "banquet",
  "marriage hall",
  "beauty parlour",
  "salon",
  "hospital",
  "clinic",
  "optics",
  "communication",
  "school",
  "academy",
  "shop",
  "store",
  "bakery",
  "cheez",
  "auto parts",
];

// White-listed luxury & major hotel brands in Karachi that might have restaurant descriptions
const FAMOUS_HOTEL_BRANDS = [
  "avari",
  "movenpick",
  "mövenpick",
  "marriott",
  "pearl continental",
  "pc hotel",
  "beach luxury",
  "regent plaza",
  "hotel mehran",
  "ramada",
  "dreamworld",
  "excelsior",
  "hilltop hotel",
  "royal city hotel",
  "369° hotels",
  "369 hotels",
  "park lane hotel",
  "swisstel",
  "rotana",
];

async function main() {
  console.log("Fetching Hotels & Accommodations category ID (slug: hotels-accommodations)...");
  const { rows: catRows } = await query(
    `SELECT id FROM categories WHERE slug = 'hotels-accommodations' LIMIT 1`
  );

  if (catRows.length === 0) {
    console.error("Error: Subcategory 'hotels-accommodations' not found in database.");
    process.exit(1);
  }

  const hotelCategoryId = parseInt(catRows[0].id, 10);
  console.log(`Found Hotels & Accommodations category ID: ${hotelCategoryId}`);

  console.log("Analyzing all listings in database...");
  const { rows: listings } = await query(
    `SELECT id, name, description, address, category_id FROM listings`
  );

  console.log(`Loaded ${listings.length} listings to analyze.`);

  type MatchedListing = {
    id: number;
    name: string;
    description: string;
    address: string;
    isPrimary: boolean;
    relevanceScore: number;
  };

  const matched: MatchedListing[] = [];

  for (const l of listings) {
    const listingId = parseInt(l.id, 10);
    const nameLower = (l.name || "").toLowerCase();
    const descLower = (l.description || "").toLowerCase();
    const fullText = `${nameLower} ${descLower}`;

    const isFamousBrand = FAMOUS_HOTEL_BRANDS.some((brand) =>
      fullText.includes(brand)
    );

    if (isFamousBrand) {
      matched.push({
        id: listingId,
        name: l.name,
        description: l.description || "",
        address: l.address || "",
        isPrimary: l.category_id == null,
        relevanceScore: 0.98,
      });
      continue;
    }

    const hasHotelKeyword = HOTEL_KEYWORDS.some((kw) => {
      // Avoid matching "inn" inside "dinner" or "pin"
      if (kw === "inn") {
        return /\binn\b/i.test(fullText);
      }
      return fullText.includes(kw);
    });

    if (!hasHotelKeyword) continue;

    const isExcluded = EXCLUSIONS.some((ex) => fullText.includes(ex));
    if (isExcluded) continue;

    matched.push({
      id: listingId,
      name: l.name,
      description: l.description || "",
      address: l.address || "",
      isPrimary: l.category_id == null,
      relevanceScore: 0.92,
    });
  }

  console.log(`Found ${matched.length} genuine hotel/accommodation listings.`);

  if (matched.length > 0) {
    console.log("Linking matched listings to Hotels & Accommodations in database...");

    const CHUNK_SIZE = 200;
    for (let i = 0; i < matched.length; i += CHUNK_SIZE) {
      const chunk = matched.slice(i, i + CHUNK_SIZE);
      const valueTuples: string[] = [];
      const values: unknown[] = [];

      chunk.forEach((item, index) => {
        const offset = index * 4;
        valueTuples.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(item.id, hotelCategoryId, item.isPrimary, item.relevanceScore);
      });

      await query(
        `INSERT INTO listing_categories (listing_id, category_id, is_primary, relevance_score)
         VALUES ${valueTuples.join(", ")}
         ON CONFLICT (listing_id, category_id) DO UPDATE 
           SET relevance_score = EXCLUDED.relevance_score`,
        values
      );
    }
  }

  console.log("\n=======================================================");
  console.log(`CLASSIFICATION COMPLETE!`);
  console.log(`Linked ${matched.length} listings to Hotels & Accommodations (ID: ${hotelCategoryId}).`);
  console.log("Sample matched listings:");
  console.log(
    JSON.stringify(
      matched.slice(0, 15).map((m) => ({ id: m.id, name: m.name, address: m.address })),
      null,
      2
    )
  );
  console.log("=======================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Hotel classification error:", err);
  process.exit(1);
});
