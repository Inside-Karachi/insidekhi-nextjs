import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ChallengesManagement } from "@/components/admin/gamification/ChallengesManagement";
import { Target } from "lucide-react";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

export default async function ChallengesManagementPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (!isGamificationOperatorRole(profile.role as Parameters<typeof isGamificationOperatorRole>[0])) {
    redirect("/admin");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-xl">
                <Target className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Weekly Challenges
                </h1>
                <p className="text-muted-foreground mt-1">
                  Create and manage challenges to keep users engaged
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

      <ChallengesManagement />
    </div>
  );
}
