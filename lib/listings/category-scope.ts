import { query } from "@/lib/db";

export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
};

/** Expands a category id to itself plus its subcategory ids when it's a parent. */
export async function resolveCategoryIdScope(
  categoryId: number,
): Promise<number[]> {
  const { rows } = await query(
    `SELECT id, parent_id FROM categories WHERE id = $1 LIMIT 1`,
    [categoryId],
  );
  const category = rows[0];
  if (!category) return [];

  if (category.parent_id === null) {
    const { rows: subs } = await query(
      `SELECT id FROM categories WHERE parent_id = $1`,
      [categoryId],
    );
    return [categoryId, ...subs.map((s) => Number(s.id))];
  }

  return [categoryId];
}

/**
 * Resolves a category slug (as used in URLs / query params) to the category
 * row plus the id scope (self + subcategories when it's a parent). Returns
 * null for a missing/unknown/"all" slug.
 */
export async function resolveCategoryBySlugWithScope(
  slug: string | null | undefined,
): Promise<{ category: CategoryRow; categoryIds: number[] } | null> {
  if (!slug || slug === "all") return null;

  const { rows } = await query(
    `SELECT id, name, slug, parent_id FROM categories WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const category = rows[0] as CategoryRow | undefined;
  if (!category) return null;

  const categoryIds = await resolveCategoryIdScope(category.id);
  return { category, categoryIds };
}

/** SQL EXISTS clause matching a listing (by `idColumn`) against any of the given category ids via the listing_categories junction table. */
export function listingCategoriesExistsClause(
  idColumn: string,
  paramIndex: number,
): string {
  return `EXISTS (
    SELECT 1 FROM listing_categories lc
    WHERE lc.listing_id = ${idColumn} AND lc.category_id = ANY($${paramIndex}::int[])
  )`;
}
