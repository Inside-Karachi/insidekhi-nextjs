import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { ListingScraperDashboard } from "@/components/admin/listing-scraper/ListingScraperDashboard";

export const metadata = {
  title: "Listing Scraper | Admin",
  description: "Import and sync business listings from Peekaboo.guru",
};

export default async function ListingScraperPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check super_admin access
  if (profile.role !== "super_admin") {
    redirect("/admin");
  }

  // Fetch listing stats
  const [
    { rows: totalListingsRows },
    { rows: draftListingsRows },
    { rows: publishedListingsRows },
    { rows: totalBranchesRows },
    { rows: recentListings },
  ] = await Promise.all([
    query(
      `SELECT COUNT(*) FROM listings WHERE peekaboo_id IS NOT NULL`,
    ),
    query(
      `SELECT COUNT(*) FROM listings WHERE status = 'draft' AND peekaboo_id IS NOT NULL`,
    ),
    query(
      `SELECT COUNT(*) FROM listings WHERE status = 'published' AND peekaboo_id IS NOT NULL`,
    ),
    query(`SELECT COUNT(*) FROM listing_branches`),
    query(
      `SELECT id, name, status, created_at, updated_at, custom_attributes, category_id, peekaboo_id
       FROM listings
       WHERE peekaboo_id IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT 10`,
    ),
  ]);

  const initialStats = {
    totalListings: parseInt(totalListingsRows[0].count, 10) || 0,
    draftListings: parseInt(draftListingsRows[0].count, 10) || 0,
    publishedListings: parseInt(publishedListingsRows[0].count, 10) || 0,
    totalBranches: parseInt(totalBranchesRows[0].count, 10) || 0,
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
