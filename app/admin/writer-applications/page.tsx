import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { WriterApplicationsPage } from "@/components/admin/WriterApplicationsPage";

export const metadata: Metadata = {
  title: "Writer Applications | Admin | Inside Karachi",
  description: "Review and approve blog writer applications",
};

export const dynamic = "force-dynamic";

export default async function AdminWriterApplicationsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/admin");
  }

  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role ?? "")) {
    redirect("/admin");
  }

  return <WriterApplicationsPage />;
}
