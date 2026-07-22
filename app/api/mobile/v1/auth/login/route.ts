import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { MOBILE_TOKEN_TTL_MS, type MobileAuthResponse } from "@/types/mobile-auth.types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/mobile/v1/auth/login  (unauthenticated)
 *
 * Verifies email/password and returns a JWT access token in the response body
 * (mobile has no cookie jar, unlike `app/api/auth/login`). Mirrors that
 * route's DB lookup/password/verification logic.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A valid email and password are required.",
      400,
    );
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || undefined;

  const { rows } = await query(
    `SELECT p.id, p.role, p.username, p.full_name, u.email_confirmed_at, u.encrypted_password
     FROM public.profiles p
     LEFT JOIN auth.users u ON p.id = u.id
     WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
    [email],
  );
  const dbUser = rows[0];

  if (!dbUser || !dbUser.encrypted_password) {
    try {
      const { logFailedLogin } = await import("@/lib/audit");
      await logFailedLogin(email, ip, userAgent);
    } catch (logError) {
      console.error("Failed to log failed login:", logError);
    }
    throw new MobileApiError(
      "invalid_credentials",
      "Invalid credentials. Please try again.",
      401,
    );
  }

  const isPasswordCorrect = await verifyPassword(
    password,
    dbUser.encrypted_password,
  );
  if (!isPasswordCorrect) {
    try {
      const { logFailedLogin } = await import("@/lib/audit");
      await logFailedLogin(email, ip, userAgent);
    } catch (logError) {
      console.error("Failed to log failed login:", logError);
    }
    throw new MobileApiError(
      "invalid_credentials",
      "Invalid credentials. Please try again.",
      401,
    );
  }

  if (!dbUser.email_confirmed_at) {
    throw new MobileApiError(
      "email_not_confirmed",
      "Your email address has not been verified yet. Please check your inbox and click the confirmation link, or request a new one.",
      403,
    );
  }

  const token = await signToken({
    userId: dbUser.id,
    email,
    role: dbUser.role,
  });

  try {
    const { logUserLogin } = await import("@/lib/audit");
    await logUserLogin(dbUser.id, ip, userAgent);
  } catch (logError) {
    console.error("Failed to log successful login:", logError);
  }

  const response: MobileAuthResponse = {
    token,
    expiresAt: new Date(Date.now() + MOBILE_TOKEN_TTL_MS).toISOString(),
    user: {
      id: dbUser.id,
      email,
      role: dbUser.role,
      username: dbUser.username,
      full_name: dbUser.full_name,
    },
  };
  return ok(response);
});
