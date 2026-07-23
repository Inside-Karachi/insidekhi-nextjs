/**
 * Peekaboo tag → InsideKHI leaf subcategory slug.
 * Used by CSV export / future CategoryMapper wiring.
 * Keys are case-insensitive matched after trim.
 */
export const PEEKABOO_TAG_TO_CATEGORY_SLUG: Record<string, string> = {
  // Shopping → Clothing & Fashion Stores
  "Women's Wear": "clothing-fashion-stores",
  "Men's Wear": "clothing-fashion-stores",
  "Kid's Wear": "clothing-fashion-stores",
  Footwear: "clothing-fashion-stores",
  "Baby Shop": "clothing-fashion-stores",

  // Shopping → Electronics & Gadgets
  Phones: "electronics-gadgets",
  "Home Appliances": "electronics-gadgets",
  "TVs & Electronics": "electronics-gadgets",
  Computers: "electronics-gadgets",

  // Shopping → Jewelry & Accessories
  Optics: "jewelry-accessories",
  "Eye Wear": "jewelry-accessories",
  Watches: "jewelry-accessories",
  Bags: "jewelry-accessories",
  Fragrances: "jewelry-accessories",

  // Shopping → Home & Decor
  "Home Decor": "home-decor-stores",
  Furniture: "home-decor-stores",

  // Shopping → Bookstores
  "Book Shop": "bookstores-stationery-shops",

  // Hospitals → Pharmacies / Clinics / Beauty
  Pharmacy: "pharmacies",
  Labs: "hospitals-clinics",
  Makeup: "beauty-skincare-clinics",

  // Eat & Drink
  Bakery: "bakeries-desserts",
  Cakes: "bakeries-desserts",
  Sweets: "bakeries-desserts",
  Nimco: "bakeries-desserts",
  Pizza: "fast-food",
  Burgers: "fast-food",
  Fries: "fast-food",
  Sandwiches: "fast-food",
  Snacks: "fast-food",
  Biryani: "pakistani",
  Tea: "cafes",
  Beverages: "juice-bars-ice-cream-parlors",
  Shakes: "juice-bars-ice-cream-parlors",
  Chaat: "street-food",

  // Salons (top-level leaf)
  "Beauty Parlours": "salons",

  // Entertainment / Things to Do
  "Play Area": "outdoor-entertainment",
  "Swimming Pool": "outdoor-entertainment",
  Farmhouse: "adventure-outdoor-activities",
};

/** Channel / non-venue tags intentionally left unmatched */
export const PEEKABOO_TAGS_LEFT_UNMATCHED = new Set([
  "E-Store",
  "Order-Now",
]);

export function normalizePeekabooTag(tag: string): string {
  return tag.trim();
}

/**
 * Resolve first matching tag in list to a category slug.
 * Returns null if no mappable tag (or only intentionally unmatched tags).
 */
export function resolveCategorySlugFromTags(
  tags: string[],
): { slug: string; matchedTag: string } | null {
  for (const raw of tags) {
    const tag = normalizePeekabooTag(raw);
    if (!tag) continue;
    if (PEEKABOO_TAGS_LEFT_UNMATCHED.has(tag)) continue;

    const slug = PEEKABOO_TAG_TO_CATEGORY_SLUG[tag];
    if (slug) {
      return { slug, matchedTag: tag };
    }

    // Case-insensitive fallback
    const found = Object.entries(PEEKABOO_TAG_TO_CATEGORY_SLUG).find(
      ([key]) => key.toLowerCase() === tag.toLowerCase(),
    );
    if (found) {
      return { slug: found[1], matchedTag: tag };
    }
  }
  return null;
}
