import type { User } from "@supabase/supabase-js";
import { MobileApiError } from "./errors";
import {
  createMobilePublicClient,
  createMobileUserClient,
  getBearerToken,
  type MobileSupabase,
} from "./supabase";

export type MobileAuthContext = {
  user: User;
  /** RLS-scoped to `user`. */
  supabase: MobileSupabase;
};

export type MobileOptionalAuthContext = {
  user: User | null;
  /** RLS-scoped to `user` when present, otherwise an anon public client. */
  supabase: MobileSupabase;
};

/**
 * Requires a valid Bearer access token. Returns the authenticated user and an
 * RLS-scoped client. Throws `not_authenticated` (401) when missing/invalid.
 */
export async function requireMobileUser(
  request: Request,
): Promise<MobileAuthContext> {
  const token = getBearerToken(request);
  if (!token) {
    throw new MobileApiError(
      "not_authenticated",
      "Authentication required.",
      401,
    );
  }

  const supabase = createMobileUserClient(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new MobileApiError(
      "not_authenticated",
      "Invalid or expired token.",
      401,
    );
  }

  return { user, supabase };
}

/**
 * Resolves the user when a valid token is present, otherwise returns a public
 * anon client. Never throws on a missing/invalid token - for endpoints whose
 * behaviour is enriched (but not gated) by being signed in.
 */
export async function getOptionalMobileUser(
  request: Request,
): Promise<MobileOptionalAuthContext> {
  const token = getBearerToken(request);
  if (!token) {
    return { user: null, supabase: createMobilePublicClient() };
  }

  const supabase = createMobileUserClient(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return { user: null, supabase: createMobilePublicClient() };
  }

  return { user, supabase };
}
