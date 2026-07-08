import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import type { JWTPayload } from "@/lib/auth/jwt";

export type SessionUser = {
  id: string;
  email?: string;
};

export type SessionProfile = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  points?: number | null;
  role?: string;
  active_role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type RequireSessionResult = {
  session: JWTPayload;
  user: SessionUser;
  profile: SessionProfile | null;
};

/**
 * Server-side gate for pages/layouts that require the custom JWT cookie.
 * Redirects to /login when missing. Optionally loads the profiles row.
 */
export async function requireSessionUser(options?: {
  /** When true (default), also fetch profiles for the session user. */
  withProfile?: boolean;
  /** Redirect here when session is missing. */
  loginPath?: string;
}): Promise<RequireSessionResult> {
  const loginPath = options?.loginPath ?? "/login";
  const withProfile = options?.withProfile !== false;

  const session = await getSessionFromCookies();
  if (!session) {
    redirect(loginPath);
  }

  const user: SessionUser = {
    id: session.userId,
    email: session.email,
  };

  if (!withProfile) {
    return { session, user, profile: null };
  }

  const { rows } = await query(
    `SELECT * FROM public.profiles WHERE id = $1 LIMIT 1`,
    [session.userId],
  );

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return { session, user, profile: null };
  }

  // Normalize null role → undefined so callers match existing UI prop types.
  const profile: SessionProfile = {
    ...row,
    id: String(row.id),
    role: (row.role as string | null | undefined) ?? undefined,
  };

  return { session, user, profile };
}
