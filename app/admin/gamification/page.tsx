import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GamificationDashboard } from "@/components/admin/gamification/GamificationDashboard";
import {
  canManageGamificationSettings,
  isGamificationOperatorRole,
} from "@/lib/auth/gamification-permissions";

export default async function GamificationPage() {
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

  // Operators can access the dashboard; only super_admin can access settings tools.
  const isOperator = isGamificationOperatorRole(profile.role);
  if (!isOperator) {
    redirect("/admin");
  }

  const canManageSettings = canManageGamificationSettings(profile.role);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Gamification Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor XP distribution, user engagement, and rank progression
              </p>
            </div>
          </div>
        </div>
      </div>

      <GamificationDashboard canManageSettings={canManageSettings} />
    </div>
  );
}
