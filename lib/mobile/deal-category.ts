/**
 * Maps listing category slug/name → the six Discounts UI buckets used by the
 * mobile deals catalog (`dining` … `travel`). Cafes fold into dining.
 */

export type MobileDealCategory =
  | "dining"
  | "shopping"
  | "beauty"
  | "hotels"
  | "entertainment"
  | "travel";

const SLUG_TO_DEAL_CATEGORY: Record<string, MobileDealCategory> = {
  "restaurants-cafes": "dining",
  "pakistani-desi-cuisine": "dining",
  "cafes-coworking-spots": "dining",
  "fast-food-street-food": "dining",
  "bakeries-desserts": "dining",
  "juice-bars-beverages": "dining",
  "fine-dining-buffets": "dining",
  "shopping-malls-outlets": "shopping",
  "apparel-clothing": "shopping",
  "salons-spas": "beauty",
  "cosmetics-fragrances": "beauty",
  "entertainment-recreation": "entertainment",
  "gaming-lounges-arcades": "entertainment",
  "live-music-comedy-venues": "entertainment",
  "parks-outdoor-spaces": "entertainment",
  "cinemas-amusement-parks": "entertainment",
  "padel-cricket-futsal-clubs": "entertainment",
  "gyms-fitness-centers": "entertainment",
  "venues-rentals": "entertainment",
  "travel-tourism": "travel",
};

/** Leaf / family → dining sub-filter chip labels on category drill-down. */
const SLUG_TO_SUB: Record<string, string> = {
  "cafes-coworking-spots": "Cafés",
  "fast-food-street-food": "Fast Food",
  "fine-dining-buffets": "Fine Dining",
  "pakistani-desi-cuisine": "BBQ",
  "bakeries-desserts": "Cafés",
  "juice-bars-beverages": "Cafés",
  "restaurants-cafes": "Fine Dining",
};

function guessFromName(name: string | null | undefined): MobileDealCategory | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (
    /restaurant|cafe|café|dining|food|bakery|dessert|juice|bbq|grill/.test(n)
  ) {
    return "dining";
  }
  if (/shop|mall|retail|apparel|clothing|boutique/.test(n)) return "shopping";
  if (/salon|spa|beauty|cosmetic|wellness|barber/.test(n)) return "beauty";
  if (/hotel|stay|lodging|resort/.test(n)) return "hotels";
  if (/travel|tour|airline|flight/.test(n)) return "travel";
  if (
    /cinema|movie|entertainment|park|arcade|gaming|music|sport|gym|fitness|club/.test(
      n,
    )
  ) {
    return "entertainment";
  }
  return null;
}

/**
 * Resolve Discounts category + optional dining subCategory from listing
 * category slug/name. Unmapped categories fall back to `entertainment` so
 * the deal still appears in All Deals / For You (category grid counts only
 * the six buckets).
 */
export function mapListingToDealCategory(
  slug: string | null | undefined,
  name: string | null | undefined,
): { category: MobileDealCategory; subCategory?: string } {
  const fromSlug = slug ? SLUG_TO_DEAL_CATEGORY[slug] : undefined;
  const category =
    fromSlug ?? guessFromName(name) ?? guessFromName(slug) ?? "entertainment";
  const subCategory =
    category === "dining" && slug ? SLUG_TO_SUB[slug] : undefined;
  return subCategory ? { category, subCategory } : { category };
}
