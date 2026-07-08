import { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessChangeRequestsPage } from "@/components/business-owner/BusinessChangeRequestsPage";
import { requireSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Change Requests | Business Portal | Inside Karachi",
  description: "View and manage your listing change requests",
};

export const dynamic = "force-dynamic";

export default async function ChangeRequestsRoute() {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  const layoutUser = { id: user.id, email: user.email } as User;

  return <BusinessChangeRequestsPage user={layoutUser} profile={profile} />;
}
