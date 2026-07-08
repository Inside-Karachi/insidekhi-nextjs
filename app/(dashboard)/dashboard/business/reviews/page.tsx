import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BusinessReviewsPage } from "@/components/business-owner/BusinessReviewsPage";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
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

  return <BusinessReviewsPage user={user} />;
}
