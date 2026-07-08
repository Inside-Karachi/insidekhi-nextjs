import React from "react";
import { PremiumProfilePage } from "@/components/dashboard/PremiumProfilePage";
import { requireSessionUser } from "@/lib/auth/require-session";

export default async function ProfilePage() {
  const { user, profile } = await requireSessionUser();

  return <PremiumProfilePage user={user} profile={profile} />;
}
