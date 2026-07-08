import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// NOTE: Admin landing canonical is `/dashboard`. To avoid duplication and
// keep a single admin landing experience, we redirect `/admin` -> `/dashboard`.
// This preserves bookmarks but ensures the canonical dashboard view is served.
export default async function AdminPage() {
  const supabase = await createServerSupabase();

  // Check current user - if not logged in, send to login
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile and check admin privileges. If not an admin, send them to /dashboard
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  // If admin, redirect to canonical dashboard page
  redirect("/dashboard");
}
