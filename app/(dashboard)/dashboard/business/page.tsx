import { redirect } from "next/navigation";
import { BusinessOwnerDashboard } from "@/components/business-owner/BusinessOwnerDashboard";
import { requireSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage() {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check if user has business_owner role or can switch to it
  const canAccessBusiness =
    profile.role === "business_owner" ||
    profile.active_role === "business_owner" ||
    profile.role === "admin" ||
    profile.role === "super_admin";

  if (!canAccessBusiness) {
    redirect("/dashboard");
  }

  const layoutUser = { id: user.id, email: user.email } as User;

  return <BusinessOwnerDashboard user={layoutUser} profile={profile} />;
}
