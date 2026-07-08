import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { BusinessChangeRequestsPage } from "@/components/business-owner/BusinessChangeRequestsPage";

export const metadata: Metadata = {
  title: "Change Requests | Business Portal | Inside Karachi",
  description: "View and manage your listing change requests",
};

export const dynamic = "force-dynamic";

export default async function ChangeRequestsRoute() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return <BusinessChangeRequestsPage user={user} profile={profile} />;
}
