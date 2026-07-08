import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { ListingScraperDashboard } from "@/components/admin/listing-scraper/ListingScraperDashboard";

export const metadata = {
  title: "Listing Scraper | Admin",
  description: "Import and sync business listings from Peekaboo.guru",
};

export default async function ListingScraperPage() {
  const supabase = await createServerSupabase();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  // Check super_admin access
  if (profile.role !== "super_admin") {
    redirect("/admin");
  }

  // Fetch listing stats
  const { count: totalListings } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .not("peekaboo_id", "is", null);

  const { count: draftListings } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "draft")
    .not("peekaboo_id", "is", null);

  const { count: publishedListings } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .not("peekaboo_id", "is", null);

  // Fetch branches stats
  const { count: totalBranches } = await supabase
    .from("listing_branches")
    .select("*", { count: "exact", head: true });

  // Fetch recent synced listings
  const { data: recentListings } = await supabase
    .from("listings")
    .select(
      "id, name, status, created_at, updated_at, custom_attributes, category_id, peekaboo_id",
    )
    .not("peekaboo_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10);

  const initialStats = {
    totalListings: totalListings || 0,
    draftListings: draftListings || 0,
    publishedListings: publishedListings || 0,
    totalBranches: totalBranches || 0,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Listing Scraper
              </h1>
              <p className="text-muted-foreground mt-1">
                Import, sync, and manage business listings from Peekaboo.guru
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Component */}
      <ListingScraperDashboard
        initialStats={initialStats}
        recentListings={recentListings || []}
      />
    </div>
  );
}
