import { MobileApiError } from "./errors";
import { verifyTokenDetailed } from "@/lib/auth/jwt";
import { isAccountDeleted } from "@/lib/auth/account-status";

export type MobileUser = {
  id: string;
  email?: string;
  role: string;
};

/**
 * Extracts a Bearer token from the `Authorization` header.
 * Returns null when absent or malformed. Tokens are accepted ONLY from this
 * header.
 */
function getBearerToken(request: Request): string | null {
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type MobileAuthContext = {
  user: MobileUser;
};

export type MobileOptionalAuthContext = {
  user: MobileUser | null;
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

  const verification = await verifyTokenDetailed(token);
  if (!verification.valid) {
    // Distinct code for a structurally broken token (malformed/tampered,
    // not merely expired): unlike a bare `not_authenticated`, which the
    // mobile client gives the benefit of the doubt as a transient backend
    // blip, this can never resolve itself - the client must drop the
    // session immediately instead of retrying forever.
    throw new MobileApiError(
      verification.expired ? "not_authenticated" : "invalid_token",
      verification.expired ? "Invalid or expired token." : "Session is invalid. Please sign in again.",
      401,
    );
  }
  const payload = verification.payload;

  // Tokens have no server-side revocation list, so a self-deleted account's
  // still-valid token is rejected here on every request instead of only
  // once it naturally expires (up to 7 days later).
  //
  // Distinct code (`account_deleted`, not `not_authenticated`): the mobile
  // client treats a `not_authenticated` 401 on a token that hasn't expired
  // yet as a transient backend blip and keeps the session, but must drop it
  // immediately for a real revocation like this one.
  if (await isAccountDeleted(payload.userId)) {
    throw new MobileApiError(
      "account_deleted",
      "This account no longer exists.",
      401,
    );
  }

  return {
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
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
    return { user: null };
  }

  const verification = await verifyTokenDetailed(token);
  if (!verification.valid) {
    return { user: null };
  }
  const payload = verification.payload;

  if (await isAccountDeleted(payload.userId)) {
    return { user: null };
  }

  return {
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
  };
}


