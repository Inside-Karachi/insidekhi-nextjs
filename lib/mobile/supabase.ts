import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type MobileSupabase = SupabaseClient<Database>;

function getEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or anon key environment variables");
  }
  return { url, anonKey };
}

/**
 * Extracts a Bearer token from the `Authorization` header.
 * Returns null when absent or malformed. Tokens are accepted ONLY from this
 * header - never from query string or path (see mobile API section 2.3).
 */
export function getBearerToken(request: Request): string | null {
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Anon, user-context-free client for public reads. RLS applies as `anon`.
 * No cookies, no session persistence - appropriate for stateless mobile calls.
 */
export function createMobilePublicClient(): MobileSupabase {
  const { url, anonKey } = getEnv();
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * User-scoped client built from a validated access token. The token is attached
 * as the `Authorization` header so PostgREST enforces RLS as that user - every
 * query is automatically scoped to what the user is allowed to see.
 */
export function createMobileUserClient(accessToken: string): MobileSupabase {
  const { url, anonKey } = getEnv();
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Service-role client - BYPASSES RLS. Use ONLY for narrowly-scoped privileged
 * operations the caller's RLS cannot perform (e.g. writing a review image to the
 * publicly-served `reviews/` storage prefix, which only `service_role` may do),
 * and ONLY after the route has already authenticated the caller and enforced
 * ownership/authorization itself. Never expose this client's reach to the client.
 */
export function createMobileServiceClient(): MobileSupabase {
  const { url } = getEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }
  return createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
