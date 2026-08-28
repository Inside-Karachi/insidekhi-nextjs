import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  getPaginationParams,
  calculatePagination,
} from "@/lib/blogs/api-utils";
import { getPostCategoriesMap } from "@/lib/blogs/categories";

export const dynamic = "force-dynamic";

/**
 * GET /api/blogs
 * Public: list published blog posts, paginated.
 * Optional filters: ?category=<slug> ?q=<search>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit } = getPaginationParams(searchParams);
    const offset = (page - 1) * limit;
    const categorySlug = searchParams.get("category") || undefined;
    const q = searchParams.get("q")?.trim() || undefined;

    const whereParams: unknown[] = [];
    const whereClauses = [`p.status = 'published'`];

    let categoryJoin = "";
    if (categorySlug) {
      whereParams.push(categorySlug);
      categoryJoin = `JOIN blog_post_categories bpc ON bpc.post_id = p.id
         JOIN blog_categories bc ON bc.id = bpc.category_id AND bc.slug = $${whereParams.length}`;
    }

    if (q) {
      whereParams.push(`%${q}%`);
      whereClauses.push(
        `(p.title ILIKE $${whereParams.length} OR p.excerpt ILIKE $${whereParams.length})`,
      );
    }

    const whereSql = whereClauses.join(" AND ");

    const countResult = await query(
      `SELECT COUNT(DISTINCT p.id) FROM posts p ${categoryJoin} WHERE ${whereSql}`,
      whereParams,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...whereParams, limit, offset];
    const { rows: posts } = await query(
      `SELECT DISTINCT p.id, p.title, p.slug, p.excerpt, p.featured_image_url,
              to_json(p.published_at) #>> '{}' AS published_at,
              pr.full_name AS author_full_name
       FROM posts p
       LEFT JOIN profiles pr ON pr.id = p.author_id
       ${categoryJoin}
       WHERE ${whereSql}
       ORDER BY published_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const postIds = posts.map((p) => Number(p.id));
    const categoriesByPost = await getPostCategoriesMap(postIds);

    const items = posts.map((p) => ({
      id: Number(p.id),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      featured_image_url: p.featured_image_url,
      published_at: p.published_at,
      author: { full_name: p.author_full_name },
      categories: categoriesByPost.get(Number(p.id)) ?? [],
    }));

    return apiSuccess({
      items,
      pagination: calculatePagination(total || 0, page, limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
