
import { query } from "@/lib/db";
import { RecentPostsSection } from "@/components/homepage/RecentPostsSection";

export async function RecentPostsContainer() {
    const { rows } = await query(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image_url,
                to_json(p.published_at) #>> '{}' AS published_at,
                pr.full_name AS author_full_name
         FROM posts p
         LEFT JOIN profiles pr ON pr.id = p.author_id
         WHERE p.status = 'published'
         ORDER BY p.published_at DESC
         LIMIT 4`,
    );

    const recentPosts = rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        featured_image_url: row.featured_image_url,
        published_at: row.published_at,
        author: { full_name: row.author_full_name },
    }));

    return <RecentPostsSection posts={recentPosts || []} />;
}
