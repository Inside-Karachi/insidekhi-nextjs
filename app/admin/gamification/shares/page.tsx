import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShareVerificationPage } from "@/components/admin/ShareVerificationPage";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

export default async function AdminSharesPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (!isGamificationOperatorRole(profile.role)) {
    redirect("/admin");
  }

  return <ShareVerificationPage />;
}
