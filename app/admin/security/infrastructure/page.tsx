import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth/require-session";
import { InfrastructureMonitoringManagement } from "@/components/admin/InfrastructureMonitoringManagement";
import { ArrowLeft } from "lucide-react";

export default async function InfrastructureMonitoringPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "super_admin") {
    redirect("/admin");
  }

  return (
    <div className="space-y-8">
      {/* Back to Security Center */}
      <div>
        <Link
          href="/admin/security"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Security Center</span>
        </Link>
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <svg
                className="h-6 w-6 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Infrastructure Monitoring
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Monitor API health, database performance, and Core Web Vitals in
            real-time.
          </p>
        </div>
      </div>

      <InfrastructureMonitoringManagement />
    </div>
  );
}
