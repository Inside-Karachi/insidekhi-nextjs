import Link from "next/link";
import type { Metadata } from "next";
import { query } from "@/lib/db";
import { getPostCategoriesMap } from "@/lib/blogs/categories";
import { GuideCard } from "@/components/guides/GuideCard";
import { BookOpen } from "lucide-react";

export const revalidate = 60;

const PAGE_SIZE = 12;

interface GuidesPageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}

export async function generateMetadata({
  searchParams,
}: GuidesPageProps): Promise<Metadata> {
  const { category } = await searchParams;
  return {
    title: category
      ? `${category} Guides | Inside Karachi`
      : "Guides | Inside Karachi",
    description:
      "Insider tips, local secrets, and comprehensive guides to help you experience Karachi like a true local.",
  };
}

export default async function GuidesPage({ searchParams }: GuidesPageProps) {
  const resolved = await searchParams;
  const categorySlug = resolved.category;
  const q = resolved.q?.trim();
  const page = Math.max(1, parseInt(resolved.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

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

  const [countRes, postsRes, categoriesRes] = await Promise.all([
    query(
      `SELECT COUNT(DISTINCT p.id) FROM posts p ${categoryJoin} WHERE ${whereSql}`,
      whereParams,
    ),
    query(
      `SELECT DISTINCT p.id, p.title, p.slug, p.excerpt, p.featured_image_url,
              to_json(p.published_at) #>> '{}' AS published_at,
              pr.full_name AS author_full_name
       FROM posts p
       LEFT JOIN profiles pr ON pr.id = p.author_id
       ${categoryJoin}
       WHERE ${whereSql}
       ORDER BY p.published_at DESC
       LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
      [...whereParams, PAGE_SIZE, offset],
    ),
    query(
      `SELECT id, name, slug FROM blog_categories WHERE is_enabled = true ORDER BY display_order, name`,
    ),
  ]);

  const total = parseInt(countRes.rows[0].count, 10) || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const postIds = postsRes.rows.map((p) => Number(p.id));
  const categoriesByPost = await getPostCategoriesMap(postIds);

  const posts = postsRes.rows.map((p) => ({
    id: Number(p.id),
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    featured_image_url: p.featured_image_url,
    published_at: p.published_at,
    author: { full_name: p.author_full_name },
    categories: categoriesByPost.get(Number(p.id)) ?? [],
  }));

  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/guides?${qs}` : "/guides";
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="text-center mb-10 md:mb-14">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            <span className="gradient-text-primary">Guides</span>
          </h1>
        </div>
        <p className="max-w-2xl mx-auto text-muted-foreground">
          Insider tips, local secrets, and comprehensive guides to help you
          experience Karachi like a true local.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-10">
        <Link
          href="/guides"
          className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
            !categorySlug
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border/50 hover:bg-accent/50"
          }`}
        >
          All
        </Link>
        {categoriesRes.rows.map((category) => (
          <Link
            key={category.id}
            href={`/guides?category=${category.slug}`}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              categorySlug === category.slug
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 hover:bg-accent/50"
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No guides found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <GuideCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-12">
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1)}
              className="px-4 py-2 rounded-lg border border-border/50 text-sm hover:bg-accent/50"
            >
              Previous
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg border border-border/30 text-sm text-muted-foreground opacity-50">
              Previous
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildPageHref(page + 1)}
              className="px-4 py-2 rounded-lg border border-border/50 text-sm hover:bg-accent/50"
            >
              Next
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg border border-border/30 text-sm text-muted-foreground opacity-50">
              Next
            </span>
          )}
        </div>
      )}
    </div>
  );
}
