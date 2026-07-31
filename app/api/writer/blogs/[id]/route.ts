import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  verifyWriter,
  verifyPostOwnership,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/blogs/api-utils";
import { getPostCategoryIds, syncPostCategories } from "@/lib/blogs/categories";
import { moveTempFeaturedImage } from "@/lib/blogs/images";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/writer/blogs/[id]
 * The authenticated writer's own post, for editing.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      return apiError("Invalid post ID", 400);
    }

    const userId = await verifyWriter();
    await verifyPostOwnership(userId, postId);

    const { rows } = await query(
      `SELECT id, title, slug, excerpt, content, featured_image_url, status,
              review_notes,
              to_json(created_at) #>> '{}' AS created_at,
              to_json(updated_at) #>> '{}' AS updated_at
       FROM posts WHERE id = $1`,
      [postId],
    );
    const post = rows[0];
    if (!post) {
      return apiError("Post not found", 404);
    }

    const categoryIds = await getPostCategoryIds(postId);

    return apiSuccess({ ...post, id: Number(post.id), category_ids: categoryIds });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateBlogSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  excerpt: z.string().max(300).nullish(),
  content: z.string().min(50).optional(),
  temp_file_name: z.string().nullish(),
  category_ids: z.array(z.number().int().positive()).min(1).optional(),
  primary_category_id: z.number().int().positive().nullish(),
});

/**
 * PUT /api/writer/blogs/[id]
 * Update a post owned by the authenticated writer. Only allowed while
 * status is draft or rejected - editing a published post isn't supported
 * in this pass (no change-request flow like listings has).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      return apiError("Invalid post ID", 400);
    }

    const userId = await verifyWriter();
    await verifyPostOwnership(userId, postId);

    const { rows: existingRows } = await query(
      `SELECT status FROM posts WHERE id = $1`,
      [postId],
    );
    const existing = existingRows[0];
    if (!existing) {
      return apiError("Post not found", 404);
    }
    if (!["draft", "rejected"].includes(existing.status)) {
      return apiError(
        `Cannot edit a post with status: ${existing.status}`,
        400,
      );
    }

    const rawBody = await request.json();
    const body = Object.fromEntries(
      Object.entries(rawBody).map(([key, value]) => [
        key,
        value === "" ? null : value,
      ]),
    );
    const validationResult = updateBlogSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        validationResult.error.flatten().fieldErrors,
      );
    }
    const data = validationResult.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) {
      setClauses.push(`title = $${idx++}`);
      values.push(data.title);
    }
    if (data.excerpt !== undefined) {
      setClauses.push(`excerpt = $${idx++}`);
      values.push(data.excerpt);
    }
    if (data.content !== undefined) {
      setClauses.push(`content = $${idx++}`);
      values.push(data.content);
    }

    let featuredImageUrl: string | undefined;
    if (data.temp_file_name) {
      try {
        featuredImageUrl = await moveTempFeaturedImage(
          userId,
          postId,
          data.temp_file_name,
        );
        setClauses.push(`featured_image_url = $${idx++}`);
        values.push(featuredImageUrl);
      } catch (imageError) {
        console.error("Failed to move featured image:", imageError);
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = $${idx++}`);
      values.push(new Date().toISOString());
      values.push(postId);

      await query(
        `UPDATE posts SET ${setClauses.join(", ")} WHERE id = $${idx}`,
        values,
      );
    }

    if (data.category_ids !== undefined) {
      try {
        await syncPostCategories(postId, data.category_ids, data.primary_category_id);
      } catch (syncError) {
        console.error("Failed to sync post categories:", syncError);
      }
    }

    return apiSuccess({ id: postId, updated: true }, "Post updated successfully.");
  } catch (error) {
    return handleApiError(error);
  }
}
