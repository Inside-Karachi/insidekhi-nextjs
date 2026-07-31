import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";
import { getOptionalSessionUser } from "@/lib/auth/require-session";
import { getPostCategoriesMap } from "@/lib/blogs/categories";
import { renderMarkdown } from "@/lib/blogs/markdown";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Calendar, User } from "lucide-react";

export const dynamic = "force-dynamic";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

async function loadPost(slug: string) {
  const { rows } = await query(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.featured_image_url, p.status,
            to_json(p.published_at) #>> '{}' AS published_at,
            pr.full_name AS author_full_name, pr.avatar_url AS author_avatar_url
     FROM posts p
     LEFT JOIN profiles pr ON pr.id = p.author_id
     WHERE p.slug = $1
     LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} | Inside Karachi Guides`,
    description: (post.excerpt || post.content || "").substring(0, 160),
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const post = await loadPost(slug);

  if (!post) {
    notFound();
  }

  if (post.status !== "published") {
    const sessionResult = await getOptionalSessionUser();
    const role = sessionResult?.profile?.role;
    const canPreview = role === "admin" || role === "super_admin";
    if (!canPreview) {
      notFound();
    }
  }

  const categoriesByPost = await getPostCategoriesMap([Number(post.id)]);
  const categories = categoriesByPost.get(Number(post.id)) ?? [];

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <article className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl">
      {post.status !== "published" && (
        <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm">
          Preview only - this guide is not published yet.
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/guides?category=${category.slug}`}
            className="px-3 py-1 rounded-full text-xs border border-border/50 hover:bg-accent/50"
          >
            {category.name}
          </Link>
        ))}
      </div>

      <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
        {formattedDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formattedDate}
          </div>
        )}
        {post.author_full_name && (
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            {post.author_full_name}
          </div>
        )}
      </div>

      {post.featured_image_url && (
        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-8">
          <OptimizedImage
            src={post.featured_image_url}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
      )}

      <div
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content || "") }}
      />
    </article>
  );
}
