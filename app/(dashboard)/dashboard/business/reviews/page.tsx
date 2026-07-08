import { redirect } from "next/navigation";
import { BusinessReviewsPage } from "@/components/business-owner/BusinessReviewsPage";
import { requireSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  const canAccessBusiness =
    profile.role === "business_owner" ||
    profile.active_role === "business_owner" ||
    profile.role === "admin" ||
    profile.role === "super_admin";

  if (!canAccessBusiness) {
    redirect("/dashboard");
  }

  const layoutUser = { id: user.id, email: user.email } as User;

  return <BusinessReviewsPage user={layoutUser} />;
}
