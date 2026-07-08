import React from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PremiumProfilePage } from "@/components/dashboard/PremiumProfilePage";

export default async function ProfilePage() {
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
    <PremiumProfilePage
      user={user}
      profile={profile}
    />
  );
}
