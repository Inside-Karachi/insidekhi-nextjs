/**
 * Category Helper Functions
 * Provides utilities for checking category types based on database hierarchy
 */

import { createServerSupabase } from "@/lib/supabase/server";

// Cache for category lookups (in-memory, resets per request)
const categoryCache = new Map<
  number,
  {
    slug: string;
    parentSlug: string | null;
    isRestaurant: boolean;
  }
>();

/**
 * Check if a listing category is restaurant/food-related
 * Handles both direct categories and subcategories via parent lookup
 *
 * @param categoryId - The category ID from the listing
 * @returns Promise<boolean> - True if category or parent is food-related
 */
export async function isRestaurantCategory(
  categoryId: number | null | undefined,
): Promise<boolean> {
  if (!categoryId) return false;

  // Check cache first
  const cached = categoryCache.get(categoryId);
  if (cached !== undefined) {
    return cached.isRestaurant;
  }

  try {
    const supabase = await createServerSupabase({ publicAnon: true });

    // Fetch category with optional parent in single query
    const { data: category, error } = await supabase
      .from("categories")
      .select(
        `
        id,
        slug,
        parent:parent_id (
          slug
        )
      `,
      )
      .eq("id", categoryId)
      .single();

    if (error || !category) {
      return false;
    }

    // Extract slugs
    const categorySlug = category.slug.toLowerCase();
    const parentSlug =
      (category.parent as { slug: string } | null)?.slug?.toLowerCase() || null;

    // Check if current category or parent is food-related
    const foodRelatedSlugs = [
      "eat-drink",
      "eat-and-drink",
      "food",
      "restaurants",
      "dining",
    ];

    const isRestaurant =
      foodRelatedSlugs.some((slug) => categorySlug.includes(slug)) ||
      (parentSlug !== null &&
        foodRelatedSlugs.some((slug) => parentSlug.includes(slug)));

    // Cache the result
    categoryCache.set(categoryId, {
      slug: categorySlug,
      parentSlug,
      isRestaurant,
    });

    return isRestaurant;
  } catch (error) {
    console.error("[CATEGORY] Error checking restaurant category:", error);
    return false;
  }
}

/**
 * Clear the category cache (useful for testing or server restarts)
 */
export function clearCategoryCache(): void {
  categoryCache.clear();
}
