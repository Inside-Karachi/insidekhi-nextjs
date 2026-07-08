import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Browser Supabase client.
 *
 * Memoized into a single instance per browser context. supabase-js serializes
 * auth operations (getUser/signOut/token refresh) through a `navigator.locks`
 * Web Lock keyed by the storage key. Creating a new client on every call spawns
 * multiple GoTrue instances competing for that lock, which can deadlock and make
 * auth calls hang indefinitely. Returning one shared instance avoids that.
 */
let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";


  browserClient = createBrowserClient<Database>(
    supabaseUrl,
    anonKey,
  );

  return browserClient;
}
