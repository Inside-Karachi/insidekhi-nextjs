import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { UserDropdown } from "./UserDropdown";
import { getOptionalSessionUser } from "@/lib/auth/require-session";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// This is an async component to fetch the user's session on the server
export async function UserNav() {
  const sessionData = await getOptionalSessionUser();
  const user = sessionData
    ? ({
        id: sessionData.user.id,
        email: sessionData.user.email,
      } as SupabaseUser)
    : null;
  const profile = sessionData?.profile
    ? {
        full_name: sessionData.profile.full_name,
        avatar_url: sessionData.profile.avatar_url,
        role: sessionData.profile.role,
        active_role: sessionData.profile.active_role ?? undefined,
      }
    : null;

  return (
    <div>
      {user ? (
        <UserDropdown user={user} profile={profile} />
      ) : (
        // If the user is logged out, show a Sign In button
        <Button asChild variant="ghost" size="icon">
          <Link href="/login">
            <User className="h-5 w-5" />
            <span className="sr-only">Sign In</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
