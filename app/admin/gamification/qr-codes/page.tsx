import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminQRGenerator } from "@/components/admin/gamification/AdminQRGenerator";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

// This page uses auth - must be dynamic
export const dynamic = "force-dynamic";

export default async function QRCodesPage() {
  const supabase = await createServerSupabase();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  // Check admin access
  if (!isGamificationOperatorRole(profile.role)) {
    redirect("/admin");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-fuchsia-500/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-fuchsia-500/10 rounded-xl">
                <svg
                  className="h-6 w-6 text-fuchsia-600 dark:text-fuchsia-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-600 to-fuchsia-600 dark:from-fuchsia-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                  Partner QR Codes
                </h1>
                <p className="text-muted-foreground max-w-2xl mt-1">
                  Generate QR codes for partner locations. Users scan these
                  codes to earn XP when visiting featured venues.
                </p>
              </div>
            </div>
            <a
              href="/admin/gamification"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* QR Generator Component */}
      <AdminQRGenerator />
    </div>
  );
}
