import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  verifyWriter,
  apiSuccess,
  apiError,
  handleApiError,
  getPaginationParams,
  calculatePagination,
} from "@/lib/blogs/api-utils";
import { generateSlug } from "@/lib/utils/export-import-utils";
import { syncPostCategories } from "@/lib/blogs/categories";
import { moveTempFeaturedImage } from "@/lib/blogs/images";

export const dynamic = "force-dynamic";

/**
 * GET /api/writer/blogs
 * The authenticated writer's own posts, any status, paginated.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyWriter();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const { page, limit } = getPaginationParams(searchParams);
    const offset = (page - 1) * limit;

    const whereParams: unknown[] = [userId];
    let whereSql = "author_id = $1";
    if (status) {
      whereParams.push(status);
      whereSql += ` AND status = $${whereParams.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM posts WHERE ${whereSql}`,
      whereParams,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...whereParams, limit, offset];
    const { rows: posts } = await query(
      `SELECT id, title, slug, excerpt, featured_image_url, status,
              to_json(created_at) #>> '{}' AS created_at,
              to_json(published_at) #>> '{}' AS published_at,
              review_notes
       FROM posts
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    return apiSuccess({
      items: posts.map((p) => ({ ...p, id: Number(p.id) })),
      pagination: calculatePagination(total || 0, page, limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const createBlogSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must not exceed 200 characters"),
  excerpt: z.string().max(300, "Excerpt must not exceed 300 characters").nullish(),
  content: z
    .string({ required_error: "Content is required" })
    .min(50, "Content must be at least 50 characters"),
  temp_file_name: z.string().nullish(),
  category_ids: z
    .array(z.number().int().positive())
    .min(1, "Select at least one category"),
  primary_category_id: z.number().int().positive().nullish(),
});

/**
 * POST /api/writer/blogs
 * Create a new post (status = draft) for the authenticated writer.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyWriter();
    const rawBody = await request.json();

    const body = Object.fromEntries(
      Object.entries(rawBody).map(([key, value]) => [
        key,
        value === "" ? null : value,
      ]),
    );

    const validationResult = createBlogSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        validationResult.error.flatten().fieldErrors,
      );
    }
    const validatedData = validationResult.data;

    const baseSlug = generateSlug(validatedData.title);
    const { rows: existingRows } = await query(
      `SELECT slug FROM posts WHERE slug = $1`,
      [baseSlug],
    );
    const slug = existingRows[0]
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    let newPost;
    try {
      const { rows: insertedRows } = await query(
        `INSERT INTO posts (title, slug, excerpt, content, author_id, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         RETURNING id, slug, status, title`,
        [
          validatedData.title,
          slug,
          validatedData.excerpt || null,
          validatedData.content,
          userId,
        ],
      );
      newPost = insertedRows[0];
    } catch (insertError) {
      console.error("Insert error:", insertError);
      return apiError(
        `Failed to create post: ${insertError instanceof Error ? insertError.message : "Unknown error"}`,
        500,
        "INSERT_ERROR",
      );
    }

    const postId = Number(newPost.id);

    try {
      await syncPostCategories(
        postId,
        validatedData.category_ids,
        validatedData.primary_category_id,
      );
    } catch (syncError) {
      console.error("Failed to sync post categories:", syncError);
    }

    let featuredImageUrl: string | null = null;
    if (validatedData.temp_file_name) {
      try {
        featuredImageUrl = await moveTempFeaturedImage(
          userId,
          postId,
          validatedData.temp_file_name,
        );
        await query(`UPDATE posts SET featured_image_url = $1 WHERE id = $2`, [
          featuredImageUrl,
          postId,
        ]);
      } catch (imageError) {
        console.error("Failed to move featured image:", imageError);
      }
    }

    return apiSuccess(
      {
        id: postId,
        slug: newPost.slug,
        status: newPost.status,
        title: newPost.title,
        featured_image_url: featuredImageUrl,
      },
      "Post created successfully as draft. Submit for admin review to publish.",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
