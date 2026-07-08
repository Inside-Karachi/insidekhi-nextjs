import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventChangeRequestsPage } from "@/components/admin/EventChangeRequestsPage";

export const metadata: Metadata = {
  title: "Event Approval Queue | Admin | Inside Karachi",
  description: "Review and process organizer event change requests",
};

export const dynamic = "force-dynamic";

export default async function EventApprovalsPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has admin/lister role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/admin");
  }

  // Only allow listers, admins, and super_admins
  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role)) {
    redirect("/admin");
  }

  return <EventChangeRequestsPage />;
}
