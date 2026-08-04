import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { verifyGoogleIdToken, type GoogleIdTokenPayload } from "@/lib/auth/google";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-account";
import { signToken } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import { MOBILE_TOKEN_TTL_MS, type MobileAuthResponse } from "@/types/mobile-auth.types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idToken: z.string().min(1),
});

/**
 * POST /api/mobile/v1/auth/google  (unauthenticated)
 *
 * Verifies a Google ID token obtained natively on-device
 * (@react-native-google-signin, configured with the same web client id as
 * GOOGLE_CLIENT_ID) and reuses the same findOrCreateOAuthUser as the web
 * Google login. Mirrors `app/api/auth/google/callback`, minus the cookie
 * session - mobile gets a bearer JWT instead, same shape as login/signup.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A Google ID token is required.",
      400,
    );
  }

  let profile: GoogleIdTokenPayload;
  try {
    profile = await verifyGoogleIdToken(parsed.data.idToken);
  } catch {
    throw new MobileApiError(
      "invalid_google_token",
      "Could not verify Google sign-in. Please try again.",
      401,
    );
  }

  if (!profile.email_verified) {
    throw new MobileApiError(
      "email_not_verified",
      "Your Google account email is not verified.",
      403,
    );
  }

  const user = await findOrCreateOAuthUser("google", profile);

  const { rows } = await query(
    `SELECT username, full_name FROM public.profiles WHERE id = $1 LIMIT 1`,
    [user.id],
  );
  const profileRow = rows[0];

  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  try {
    const { logUserLogin } = await import("@/lib/audit");
    await logUserLogin(user.id);
  } catch (logError) {
    console.error("Failed to log Google mobile login:", logError);
  }

  const response: MobileAuthResponse = {
    token,
    expiresAt: new Date(Date.now() + MOBILE_TOKEN_TTL_MS).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      username: profileRow?.username ?? null,
      full_name: profileRow?.full_name ?? null,
    },
  };
  return ok(response);
});
