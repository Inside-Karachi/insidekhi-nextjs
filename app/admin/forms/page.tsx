import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { FormsManagementPage } from "@/components/admin/FormsManagementPage";

export default async function AdminFormsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister"
  ) {
    redirect("/dashboard");
  }

  return <FormsManagementPage />;
}
