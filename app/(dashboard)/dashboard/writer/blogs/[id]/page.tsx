import { redirect, notFound } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { getPostCategoryIds } from "@/lib/blogs/categories";
import { WriterBlogEditor } from "@/components/writer/WriterBlogEditor";
import type { WriterBlogDetail } from "@/types/blogs.types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWriterBlogPage({ params }: PageProps) {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  const canAccessWriter =
    profile.role === "writer" ||
    profile.active_role === "writer" ||
    profile.role === "admin" ||
    profile.role === "super_admin";

  if (!canAccessWriter) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const postId = parseInt(id, 10);
  if (isNaN(postId)) {
    notFound();
  }

  const { rows } = await query(
    `SELECT id, title, slug, excerpt, content, featured_image_url, status,
            review_notes,
            to_json(created_at) #>> '{}' AS created_at,
            to_json(updated_at) #>> '{}' AS updated_at
     FROM posts WHERE id = $1 AND author_id = $2`,
    [postId, profile.id],
  );
  const post = rows[0];
  if (!post) {
    notFound();
  }

  const categoryIds = await getPostCategoryIds(postId);

  const initialData: WriterBlogDetail = {
    id: Number(post.id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    featured_image_url: post.featured_image_url,
    status: post.status,
    review_notes: post.review_notes,
    created_at: post.created_at,
    updated_at: post.updated_at,
    category_ids: categoryIds,
  };

  return <WriterBlogEditor mode="edit" postId={postId} initialData={initialData} />;
}
