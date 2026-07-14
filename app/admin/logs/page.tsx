import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSessionUser } from "@/lib/auth/require-session";
import LogsManagementPage from "@/components/admin/LogsManagementPage";

export default async function LogsPage() {
  const { profile } = await requireSessionUser();

  // Only allow super_admin to access logs
  if (profile?.role !== "super_admin") {
    redirect("/admin");
  }

  return (
    <Suspense fallback={<div>Loading logs...</div>}>
      <LogsManagementPage />
    </Suspense>
  );
}
