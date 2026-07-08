import React from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PremiumSettingsPage } from "@/components/dashboard/PremiumSettingsPage";
import { UserSettingsProfile } from "@/types/settings.types";

export default async function SettingsPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .limit(1)
    .single();

  return (
    <PremiumSettingsPage
      profile={profile as UserSettingsProfile}
    />
  );
}
