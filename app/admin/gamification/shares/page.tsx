import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ShareVerificationPage } from "@/components/admin/ShareVerificationPage";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

export default async function AdminSharesPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (!isGamificationOperatorRole(profile.role as Parameters<typeof isGamificationOperatorRole>[0])) {
    redirect("/admin");
  }

  return <ShareVerificationPage />;
}
