import { createServerSupabase } from "@/lib/supabase/server";
import { PremiumHeader } from "@/components/dashboard/PremiumHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { getOptionalSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

interface UnifiedPremiumHeaderProps {
  context?: "public" | "dashboard";
  showDiscoveryPanel?: boolean;
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export async function UnifiedPremiumHeader({
  context = "public",
  showDiscoveryPanel = true,
  onMenuClick,
  sidebarOpen = false,
}: UnifiedPremiumHeaderProps) {
  // Resolve JWT session for public header (login sets insidekhi_session, not Supabase cookies).
  let user: User | null = null;
  let profile: {
    id: string;
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    role?: string;
    active_role?: string;
  } | null = null;

  try {
    const sessionData = await getOptionalSessionUser();
    if (sessionData) {
      user = {
        id: sessionData.user.id,
        email: sessionData.user.email,
      } as User;
      if (sessionData.profile) {
        profile = {
          id: sessionData.profile.id,
          full_name: sessionData.profile.full_name,
          username: sessionData.profile.username as string | null | undefined,
          avatar_url: sessionData.profile.avatar_url,
          role: sessionData.profile.role,
          active_role: sessionData.profile.active_role ?? undefined,
        };
      }
    }
  } catch (error) {
    // During static rendering, cookies() will throw - this is expected
    if (
      error instanceof Error &&
      error.message?.includes("Dynamic server usage")
    ) {
      // Expected during build - silently continue with null user
    } else {
      console.error("Auth error in header:", error);
    }
  }

  // Fetch navigation data only for mobile nav when needed
  let parentCategories: Array<{
    id: number;
    name: string;
    slug: string;
    categories: Array<{ id: number; name: string; slug: string }>;
  }> = [];
  let simpleNavLinks: Array<{ id: number; name: string; slug: string }> = [];

  if (context === "public") {
    try {
      const publicSupabase = await createServerSupabase({ publicAnon: true });
      const [categoriesResult, navLinksResult] = await Promise.all([
        publicSupabase
          .from("categories")
          .select("id, name, slug, categories!inner(id, name, slug)")
          .is("parent_id", null)
          .eq("is_enabled", true)
          .order("name", { ascending: true }),
        publicSupabase
          .from("categories")
          .select("id, name, slug")
          .eq("is_enabled", true)
          .in("slug", [
            "events",
            "things-to-do",
            "eat-drink",
            "where-to-stay",
            "guides-reviews",
          ]),
      ]);

      parentCategories = categoriesResult.data || [];
      simpleNavLinks = navLinksResult.data || [];
    } catch (error) {
      // During static rendering, this may fail - continue with empty nav
      if (
        !(
          error instanceof Error &&
          error.message?.includes("Dynamic server usage")
        )
      ) {
        console.error("Navigation data fetch error:", error);
      }
    }
  }

  return (
    <>
      <PremiumHeader
        user={user}
        profile={profile}
        context={context}
        showDiscoveryPanel={showDiscoveryPanel}
        onMenuClick={onMenuClick}
        sidebarOpen={sidebarOpen}
      />

      {/* Mobile Navigation - Only show on public pages */}
      {context === "public" && (
        <MobileNav
          categoryNavItems={parentCategories || []}
          simpleNavLinks={simpleNavLinks || []}
          user={user}
          profile={profile}
        />
      )}
    </>
  );
}
