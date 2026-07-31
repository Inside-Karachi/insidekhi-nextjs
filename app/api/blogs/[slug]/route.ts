import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/blogs/api-utils";
import { getPostCategoriesMap } from "@/lib/blogs/categories";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/blogs/[slug]
 * Public: a single published blog post by slug.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const { rows } = await query(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.featured_image_url,
              to_json(p.published_at) #>> '{}' AS published_at,
              to_json(p.created_at) #>> '{}' AS created_at,
              pr.full_name AS author_full_name, pr.avatar_url AS author_avatar_url
       FROM posts p
       LEFT JOIN profiles pr ON pr.id = p.author_id
       WHERE p.slug = $1 AND p.status = 'published'
       LIMIT 1`,
      [slug],
    );
    const post = rows[0];

    if (!post) {
      return apiError("Post not found", 404, "NOT_FOUND");
    }

    const categoriesByPost = await getPostCategoriesMap([Number(post.id)]);

    return apiSuccess({
      id: Number(post.id),
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      featured_image_url: post.featured_image_url,
      published_at: post.published_at,
      created_at: post.created_at,
      author: {
        full_name: post.author_full_name,
        avatar_url: post.author_avatar_url,
      },
      categories: categoriesByPost.get(Number(post.id)) ?? [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
