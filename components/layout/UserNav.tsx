import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { User } from "lucide-react";
import { UserDropdown } from "./UserDropdown";

// This is an async component to fetch the user's session on the server
export async function UserNav() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user profile if logged in
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  }

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