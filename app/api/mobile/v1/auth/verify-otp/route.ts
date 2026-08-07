import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { signToken } from "@/lib/auth/jwt";
import { verifySignupOtp } from "@/lib/auth/otp";
import { MOBILE_TOKEN_TTL_MS, type MobileAuthResponse } from "@/types/mobile-auth.types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

const OTP_ERROR_MESSAGES: Record<string, string> = {
  not_found: "No verification code found. Please request a new one.",
  expired: "This code has expired. Please request a new one.",
  too_many_attempts: "Too many incorrect attempts. Please request a new code.",
  incorrect: "Incorrect code. Please try again.",
};

/**
 * POST /api/mobile/v1/auth/verify-otp  (unauthenticated)
 *
 * Confirms the 6-digit code emailed at signup and, on success, issues the
 * JWT signup itself no longer returns directly. Mirrors
 * `app/api/auth/verify-otp` (the web route), returning a token instead of
 * setting a cookie.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A valid email and code are required.",
      400,
    );
  }
  const email = parsed.data.email.trim().toLowerCase();
  const code = parsed.data.code.trim();

  const { rows } = await query(
    "SELECT id, email, email_confirmed_at FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email],
  );
  const user = rows[0];

  if (!user) {
    throw new MobileApiError(
      "validation_error",
      "Invalid or expired code. Please request a new one.",
      400,
      "code",
    );
  }

  if (user.email_confirmed_at) {
    throw new MobileApiError(
      "validation_error",
      "This account is already verified. Please log in.",
      400,
      "code",
    );
  }

  const result = await verifySignupOtp(user.id, code);
  if (!result.ok) {
    throw new MobileApiError(
      "validation_error",
      OTP_ERROR_MESSAGES[result.reason],
      400,
      "code",
    );
  }

  await query("UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1", [
    user.id,
  ]);

  const { rows: profileRows } = await query(
    "SELECT username, full_name, role FROM public.profiles WHERE id = $1 LIMIT 1",
    [user.id],
  );
  const profile = profileRows[0];
  const role = profile?.role || "public_user";

  const token = await signToken({ userId: user.id, email: user.email, role });

  const response: MobileAuthResponse = {
    token,
    expiresAt: new Date(Date.now() + MOBILE_TOKEN_TTL_MS).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      role,
      username: profile?.username ?? null,
      full_name: profile?.full_name ?? null,
    },
  };
  return ok(response);
});
