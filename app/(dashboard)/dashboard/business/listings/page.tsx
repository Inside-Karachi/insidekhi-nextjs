import { redirect } from "next/navigation";
import { BusinessListingsPage } from "@/components/business-owner/BusinessListingsPage";
import { requireSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function ListingsManagementPage() {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Verify business owner access
  const canAccessBusiness =
    profile.role === "business_owner" ||
    profile.active_role === "business_owner" ||
    profile.role === "admin" ||
    profile.role === "super_admin";

  if (!canAccessBusiness) {
    redirect("/dashboard");
  }

  const layoutUser = { id: user.id, email: user.email } as User;

  return <BusinessListingsPage user={layoutUser} profile={profile} />;
}
