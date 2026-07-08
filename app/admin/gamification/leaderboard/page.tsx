import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LeaderboardView } from "@/components/admin/gamification/LeaderboardView";
import { Trophy } from "lucide-react";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

// This page uses auth - must be dynamic
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
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

  // Operators can view leaderboard.
  if (!isGamificationOperatorRole(profile.role)) {
    redirect("/admin");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl">
                <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  XP Leaderboard
                </h1>
                <p className="text-muted-foreground mt-1">
                  Top 100 users ranked by XP across different time periods
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

      <LeaderboardView />
    </div>
  );
}
