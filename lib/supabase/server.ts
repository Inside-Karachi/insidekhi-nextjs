import { UserRole } from "@/types/auth.types";
/**
 * Returns a Supabase client appropriate for the given user role.
 * - super_admin: uses service_role (bypasses RLS)
 * - admin, lister, others: uses regular authenticated client (RLS enforced)
 *
 * @param userRole The user's role (from Supabase profile)
 */
export async function getSupabaseClientForRole(userRole: UserRole) {
  if (userRole === "super_admin") {
    return createServerSupabase({ useServiceRole: true });
  }
  return createServerSupabase();
}
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

/**
 * Options for creating the server Supabase client.
 */
type CreateClientOptions = {
  /**
   * If true, the client will be initialized with the `service_role` key,
   * bypassing RLS. Only use on secure server code (Route Handlers, server actions).
   */
  useServiceRole?: boolean;
  /**
   * If true, use anon key in a cookieless mode for public reads.
   * This prevents stale/invalid auth cookies from forcing auth-context 401s.
   */
  publicAnon?: boolean;
};

/**
 * Creates a Supabase client for server-side usage.
 *
 * Notes:
 * - When `useServiceRole` is true we create the client with the service role key
 *   and avoid attaching cookie handlers (not needed) so RLS is bypassed reliably.
 * - For regular server components (no service role) we attach the request cookies
 *   so the client can act on behalf of the current user.
 */
export async function createServerSupabase(opts?: CreateClientOptions) {
  const useServiceRole = opts?.useServiceRole === true;
  const usePublicAnon = opts?.publicAnon === true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (useServiceRole) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
    }

    // Create a server client using the service role key. Provide a minimal cookie
    // handler to satisfy the client API types; it will be a no-op for service role.
    return createServerClient<Database>(supabaseUrl, serviceKey, {
      cookies: {
        getAll() {
          return [];
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          // no-op for service role usage; reference the param to satisfy linters
          void cookiesToSet;
        },
      },
    });
  }

  if (usePublicAnon) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable",
      );
    }

    // Public read mode: deliberately ignore request cookies so invalid/stale
    // sessions do not poison otherwise public data queries.
    return createServerClient<Database>(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return [];
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          void cookiesToSet;
        },
      },
    });
  }

  // Default: create a client that respects the request cookies (user context)
  const cookieStore = await cookies();

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable"
    );
  }

  return createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // When called from read-only Server Components, setting cookies will throw.
          // That's expected; cookie mutations should be done from middleware/route handlers.
        }
      },
    },
  });
}
