import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AchievementsPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userBadges, error } = await supabase
    .from("user_badges")
    .select(
      `badge:badges(id, name, description, icon_url, min_points_required), awarded_at`
    )
    .eq("user_id", user.id)
    .order("awarded_at", { ascending: false });

  if (error) console.error("Failed to load user badges:", error);

  return (
    <>
      {/* Back to Dashboard (replaces breadcrumbs) */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </Link>
      </div>

      {/* Badges grid or empty state */}
      {userBadges && userBadges.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {userBadges.map(
            (
              ub: {
                badge: {
                  id?: number;
                  name?: string | null;
                  description?: string | null;
                  icon_url?: string | null;
                  min_points_required?: number | null;
                } | null;
                awarded_at: string;
              },
              idx: number
            ) => (
              <article
                key={String(ub.badge?.id ?? idx) + ub.awarded_at}
                className="glass-card p-6 md:p-8 rounded-2xl border border-border/40 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-white/6 to-transparent border border-border/30 flex items-center justify-center">
                    {ub.badge?.icon_url ? (
                      <Image
                        src={ub.badge.icon_url}
                        alt={ub.badge?.name || "badge"}
                        width={64}
                        height={64}
                        className="object-cover"
                      />
                    ) : (
                      <div className="text-2xl">🏆</div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg sm:text-xl font-semibold">
                        {ub.badge?.name || "Badge"}
                      </h3>
                      <div className="text-xs text-muted-foreground">
                        {new Date(ub.awarded_at).toLocaleDateString()}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mt-2">
                      {ub.badge?.description ||
                        "Awarded for your contribution."}
                    </p>

                    {typeof ub.badge?.min_points_required === "number" && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          {ub.badge.min_points_required} points — Earned
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/80"
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-10 bg-gradient-to-br from-primary/4 to-transparent border border-border/40 text-center">
          <h2 className="text-2xl font-semibold">No badges yet</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            You have not earned any badges yet. Start exploring events, writing
            thoughtful reviews, and engaging with the community to unlock
            recognition.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/events"
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 shadow-md hover:shadow-primary/30"
            >
              Browse events
            </Link>
            <Link
              href="/listings"
              className="px-5 py-2 rounded-xl border border-border/40 transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:bg-accent/5"
            >
              Discover places
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
