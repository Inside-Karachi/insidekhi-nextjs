import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { EventChangeRequestsPage } from "@/components/admin/EventChangeRequestsPage";

export const metadata: Metadata = {
  title: "Event Approval Queue | Admin | Inside Karachi",
  description: "Review and process organizer event change requests",
};

export const dynamic = "force-dynamic";

export default async function EventApprovalsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/admin");
  }

  // Only allow listers, admins, and super_admins
  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role ?? "")) {
    redirect("/admin");
  }

  return <EventChangeRequestsPage />;
}
