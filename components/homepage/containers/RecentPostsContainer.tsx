
import { createServerSupabase } from "@/lib/supabase/server";
import { RecentPostsSection } from "@/components/homepage/RecentPostsSection";

export async function RecentPostsContainer() {
    const supabase = await createServerSupabase({ publicAnon: true });

    const { data: recentPosts } = await supabase
        .from("posts")
        .select(
            `
      id,
      title,
      slug,
      excerpt,
      featured_image_url,
      published_at,
      author:profiles(full_name)
    `
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(4);

    return <RecentPostsSection posts={recentPosts || []} />;
}
