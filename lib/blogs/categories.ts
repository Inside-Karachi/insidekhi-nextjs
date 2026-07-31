import { query } from "@/lib/db";
import { normalizeCategoryIds } from "@/lib/listings/sync-listing-categories";

export { normalizeCategoryIds };

/**
 * Replace blog_post_categories rows for a post. Uses a transaction so
 * concurrent saves don't leave partial state. Mirrors syncListingCategories,
 * minus the listings.category_id backfill (posts has no primary-category column).
 */
export async function syncPostCategories(
  postId: number,
  categoryIdsInput: unknown,
  primaryCategoryIdInput?: unknown,
): Promise<{ categoryIds: number[]; primaryCategoryId: number | null }> {
  const { categoryIds, primaryCategoryId } = normalizeCategoryIds(
    categoryIdsInput,
    primaryCategoryIdInput,
  );

  const { pool } = await import("@/lib/db");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM blog_post_categories WHERE post_id = $1`, [
      postId,
    ]);

    if (categoryIds.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      categoryIds.forEach((categoryId, i) => {
        const base = i * 3;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        values.push(postId, categoryId, categoryId === primaryCategoryId);
      });

      await client.query(
        `INSERT INTO blog_post_categories (post_id, category_id, is_primary)
         VALUES ${placeholders.join(", ")}`,
        values,
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }

  return { categoryIds, primaryCategoryId };
}

export async function getPostCategoryIds(postId: number): Promise<number[]> {
  const { rows } = (await query(
    `SELECT category_id
     FROM blog_post_categories
     WHERE post_id = $1
     ORDER BY is_primary DESC, category_id ASC`,
    [postId],
  )) as { rows: Array<{ category_id: number }> };
  return rows.map((r) => r.category_id);
}

export async function getPostCategoryIdsMap(
  postIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (postIds.length === 0) return map;

  const { rows } = (await query(
    `SELECT post_id, category_id
     FROM blog_post_categories
     WHERE post_id = ANY($1::bigint[])
     ORDER BY post_id, is_primary DESC, category_id ASC`,
    [postIds],
  )) as { rows: Array<{ post_id: number | string; category_id: number | string }> };

  for (const row of rows) {
    const postId = Number(row.post_id);
    const list = map.get(postId) ?? [];
    list.push(Number(row.category_id));
    map.set(postId, list);
  }
  return map;
}

/**
 * Categories (with names) for a set of posts, for enriching list/detail responses.
 */
export async function getPostCategoriesMap(
  postIds: number[],
): Promise<Map<number, Array<{ id: number; name: string; slug: string }>>> {
  const map = new Map<number, Array<{ id: number; name: string; slug: string }>>();
  if (postIds.length === 0) return map;

  const { rows } = await query(
    `SELECT bpc.post_id, bc.id, bc.name, bc.slug
     FROM blog_post_categories bpc
     JOIN blog_categories bc ON bc.id = bpc.category_id
     WHERE bpc.post_id = ANY($1::bigint[])
     ORDER BY bpc.post_id, bpc.is_primary DESC, bc.name ASC`,
    [postIds],
  );

  for (const row of rows) {
    const postId = Number(row.post_id);
    const list = map.get(postId) ?? [];
    list.push({ id: Number(row.id), name: row.name, slug: row.slug });
    map.set(postId, list);
  }
  return map;
}
