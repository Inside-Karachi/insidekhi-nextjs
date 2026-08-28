import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ReportsManagementPage } from "@/components/admin/ReportsManagementPage";
import { Flag } from "lucide-react";

export default async function AdminReportsPage() {
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

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Flag className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Reported Content
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Review reviews and comments flagged by users, and act on them.
          </p>
        </div>
      </div>

      <ReportsManagementPage />
    </div>
  );
}
