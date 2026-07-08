import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormsManagementPage } from "@/components/admin/FormsManagementPage";

export default async function AdminFormsPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister"
  ) {
    redirect("/dashboard");
  }

  return <FormsManagementPage />;
}
