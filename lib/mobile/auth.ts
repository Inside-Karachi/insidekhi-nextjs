import { MobileApiError } from "./errors";
import { getBearerToken, createMobileUserClient, createMobilePublicClient, type MobileSupabase } from "./supabase";
import { verifyToken } from "@/lib/auth/jwt";

export type MobileUser = {
  id: string;
  email?: string;
  role: string;
};

export type MobileAuthContext = {
  user: MobileUser;
  supabase: MobileSupabase;
};

export type MobileOptionalAuthContext = {
  user: MobileUser | null;
  supabase: MobileSupabase;
};

/**
 * Requires a valid Bearer access token. Returns the authenticated user.
 * Throws `not_authenticated` (401) when missing/invalid.
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

  const payload = await verifyToken(token);
  if (!payload) {
    throw new MobileApiError(
      "not_authenticated",
      "Invalid or expired token.",
      401,
    );
  }

  const supabase = createMobileUserClient(token);

  return {
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    supabase,
  };
}

/**
 * Resolves the user when a valid token is present, otherwise returns null.
 */
export async function getOptionalMobileUser(
  request: Request,
): Promise<MobileOptionalAuthContext> {
  const token = getBearerToken(request);
  if (!token) {
    return { user: null, supabase: createMobilePublicClient() };
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return { user: null, supabase: createMobilePublicClient() };
  }

  const supabase = createMobileUserClient(token);

  return {
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    supabase,
  };
}


