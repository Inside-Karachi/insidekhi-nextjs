import { redirect } from "next/navigation";
import { PremiumDashboardLayout } from "@/components/dashboard/PremiumDashboardLayout";
import { requireSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

// All admin pages require auth - must be dynamic
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check if user has admin access
  const isAdmin =
    profile.role === "admin" ||
    profile.role === "super_admin" ||
    profile.role === "lister";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const layoutUser = { id: user.id, email: user.email } as User;

  return (
    <PremiumDashboardLayout
      user={layoutUser}
      // SessionProfile is a superset of the layout prop shape (includes active_role, etc.)
      profile={profile as React.ComponentProps<typeof PremiumDashboardLayout>["profile"]}
    >
      {children}
    </PremiumDashboardLayout>
  );
}
