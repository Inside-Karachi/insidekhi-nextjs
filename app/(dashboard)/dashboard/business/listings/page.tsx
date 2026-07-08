import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BusinessListingsPage } from "@/components/business-owner/BusinessListingsPage";

export const dynamic = "force-dynamic";

export default async function ListingsManagementPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
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

  return <BusinessListingsPage user={user} profile={profile} />;
}
