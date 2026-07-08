import { redirect } from "next/navigation";
import dynamicImport from "next/dynamic";
import { requireSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

const BusinessAnalyticsPage = dynamicImport(
  () =>
    import("@/components/business-owner/BusinessAnalyticsPage").then(
      (mod) => mod.BusinessAnalyticsPage
    ),
  {
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted/40" />,
  }
);

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
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

  return <BusinessAnalyticsPage user={layoutUser} />;
}
