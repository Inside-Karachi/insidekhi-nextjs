import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LogsManagementPage from "@/components/admin/LogsManagementPage";

export default async function LogsPage() {
  const supabase = await createServerSupabase();

  // Check if user is authenticated and has super_admin role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile and check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Only allow super_admin to access logs
  if (profile?.role !== "super_admin") {
    redirect("/admin");
  }

  return (
    <Suspense fallback={<div>Loading logs...</div>}>
      <LogsManagementPage />
    </Suspense>
  );
}
