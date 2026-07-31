import { apiSuccess, handleApiError } from "@/lib/blogs/api-utils";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/blog-categories
 * Public: enabled blog categories, for filter UIs.
 */
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT id, name, slug, description
       FROM blog_categories
       WHERE is_enabled = true
       ORDER BY display_order ASC, name ASC`,
    );

    return apiSuccess(
      rows.map((c) => ({
        id: Number(c.id),
        name: c.name,
        slug: c.slug,
        description: c.description,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
