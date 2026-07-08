import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PremiumDashboardLayout } from "@/components/dashboard/PremiumDashboardLayout";

// All admin pages require auth - must be dynamic
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile for layout
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Check if user has admin access
  const isAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.role === "lister";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return (
    <PremiumDashboardLayout user={user} profile={profile}>
      {children}
    </PremiumDashboardLayout>
  );
}
