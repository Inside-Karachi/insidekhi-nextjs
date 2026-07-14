import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

import { getAdminAnalyticsOverview } from "@/lib/analytics/admin";
import { requireSessionUser } from "@/lib/auth/require-session";

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
  const { profile } = await requireSessionUser();

  if (!profile) {
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
