import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ListingsManagementPage } from "@/components/admin/ListingsManagementPage";

async function getDashboardStats() {
  const supabase = await createServerSupabase();

  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/api/admin/dashboard`,
      {
        headers: {
          Authorization: `Bearer ${
            (await supabase.auth.getSession()).data.session?.access_token
          }`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      return data.data?.statistics || null;
    }
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
  }

  return null;
}

export default async function AdminListingsPage() {
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

  // Check admin access
  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister"
  ) {
    redirect("/dashboard");
  }

  // Get real dashboard statistics
  await getDashboardStats();

  return (
    <div className="space-y-8">
      {/* Header - consistent with events management */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Listings Management
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage business listings, moderate content, and oversee listing
            performance across the platform.
          </p>
        </div>
      </div>

      {/* Listings Management Component */}
      <ListingsManagementPage />
    </div>
  );
}
