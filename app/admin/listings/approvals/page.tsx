import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ListingApprovalsPage } from "@/components/admin/ListingApprovalsPage";

export const metadata: Metadata = {
  title: "Listing Approval Queue | Admin | Inside Karachi",
  description: "Review and approve business owner listing submissions",
};

export const dynamic = "force-dynamic";

export default async function AdminListingApprovalsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/admin");
  }

  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role ?? "")) {
    redirect("/admin");
  }

  return <ListingApprovalsPage />;
}
