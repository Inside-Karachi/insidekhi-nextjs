import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamicImport from "next/dynamic";

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
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

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

  return <BusinessAnalyticsPage user={user} />;
}
