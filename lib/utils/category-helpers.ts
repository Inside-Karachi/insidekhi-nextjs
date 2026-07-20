/**
 * Category Helper Functions
 * Provides utilities for checking category types based on database hierarchy
 */

import { query } from "@/lib/db";

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
    // Fetch category with optional parent in single query
    const { rows } = await query(
      `SELECT c.id, c.slug, p.slug AS parent_slug
       FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id
       WHERE c.id = $1
       LIMIT 1`,
      [categoryId],
    );
    const category = rows[0];

    if (!category) {
      return false;
    }

    // Extract slugs
    const categorySlug = String(category.slug).toLowerCase();
    const parentSlug = category.parent_slug
      ? String(category.parent_slug).toLowerCase()
      : null;

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
