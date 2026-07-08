import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

import { getAdminAnalyticsOverview } from "@/lib/analytics/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const AdminAnalyticsClient = dynamic(
  () =>
    import("@/components/admin/analytics/AdminAnalyticsClient").then(
      (mod) => mod.AdminAnalyticsClient
    ),
  {
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted/40" />,
  }
);

export default async function AdminAnalyticsPage() {
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
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const overview = await getAdminAnalyticsOverview({
    viewerRole: profile.role === "super_admin" ? "super_admin" : "admin",
  });

  return <AdminAnalyticsClient initialOverview={overview} />;
}
