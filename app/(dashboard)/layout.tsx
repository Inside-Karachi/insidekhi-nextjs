import { redirect } from "next/navigation";
import { PremiumDashboardLayout } from "@/components/dashboard/PremiumDashboardLayout";
import { requireSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Layout components expect a Supabase User shape; JWT session only has id/email.
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
