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

  // Verify business owner access using effective role (active_role || role)
  // to match API authorization in verifyBusinessOwner()
  const effectiveRole = profile.active_role || profile.role;
  const canAccessBusiness =
    effectiveRole === "business_owner" ||
    effectiveRole === "admin" ||
    effectiveRole === "super_admin";

  if (!canAccessBusiness) {
    redirect("/dashboard");
  }

  const layoutUser = { id: user.id, email: user.email } as User;

  return <BusinessListingsPage user={layoutUser} profile={profile} />;
}
