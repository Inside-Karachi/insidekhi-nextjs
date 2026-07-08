import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BusinessOwnerDashboard } from "@/components/business-owner/BusinessOwnerDashboard";

export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile and verify business_owner role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
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

  return <BusinessOwnerDashboard user={user} profile={profile} />;
}
