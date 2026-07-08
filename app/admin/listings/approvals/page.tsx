import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ListingApprovalsPage } from "@/components/admin/ListingApprovalsPage";

export const metadata: Metadata = {
  title: "Listing Approval Queue | Admin | Inside Karachi",
  description: "Review and approve business owner listing submissions",
};

export const dynamic = "force-dynamic";

export default async function AdminListingApprovalsPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/admin");
  }

  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role)) {
    redirect("/admin");
  }

  return <ListingApprovalsPage />;
}
