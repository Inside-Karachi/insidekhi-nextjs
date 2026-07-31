import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { WriterHomePage } from "@/components/writer/WriterHomePage";

export const dynamic = "force-dynamic";

export default async function WriterDashboardPage() {
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

  const [statsRes, recentRes] = await Promise.all([
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM posts WHERE author_id = $1 GROUP BY status`,
      [profile.id],
    ),
    query(
      `SELECT id, title, slug, status,
              to_json(created_at) #>> '{}' AS created_at
       FROM posts
       WHERE author_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [profile.id],
    ),
  ]);

  const counts: Record<string, number> = {
    draft: 0,
    pending_approval: 0,
    published: 0,
    rejected: 0,
  };
  for (const row of statsRes.rows) {
    counts[row.status] = Number(row.count);
  }

  const recentPosts = recentRes.rows.map((p) => ({
    id: Number(p.id),
    title: p.title,
    slug: p.slug,
    status: p.status,
    created_at: p.created_at,
  }));

  return (
    <WriterHomePage
      fullName={profile.full_name || null}
      stats={counts}
      recentPosts={recentPosts}
    />
  );
}
