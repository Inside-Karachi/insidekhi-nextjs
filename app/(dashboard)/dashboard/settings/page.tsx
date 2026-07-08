import React from "react";
import { PremiumSettingsPage } from "@/components/dashboard/PremiumSettingsPage";
import { UserSettingsProfile } from "@/types/settings.types";
import { requireSessionUser } from "@/lib/auth/require-session";

export default async function SettingsPage() {
  const { profile } = await requireSessionUser();

  return (
    <PremiumSettingsPage profile={profile as UserSettingsProfile} />
  );
}
