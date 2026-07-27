import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

const RECOVERY_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, matches the web confirm route

const bodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/(?=.*[a-z])/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/(?=.*[A-Z])/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/(?=.*\d)/.test(password)) return "Password must contain at least one number";
  return null;
}

/**
 * POST /api/mobile/v1/auth/reset-password  (unauthenticated)
 *
 * Confirms a recovery token + sets a new password. Returns `{ success: true }`
 * only — unlike the web confirm route this mirrors, it does not auto-log the
 * user in; the app sends them to sign in with the new password.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A reset token and new password are required.",
      400,
    );
  }
  const { token: recoveryToken, newPassword } = parsed.data;

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    throw new MobileApiError("validation_error", passwordError, 400, "newPassword");
  }

  const { rows } = await query(
    `SELECT id, email, recovery_sent_at
     FROM auth.users
     WHERE recovery_token = $1
     LIMIT 1`,
    [recoveryToken],
  );
  const authUser = rows[0];

  if (!authUser) {
    throw new MobileApiError(
      "invalid_reset_token",
      "Invalid or expired reset link. Please request a new password reset.",
      400,
    );
  }

  const sentAt = authUser.recovery_sent_at
    ? new Date(authUser.recovery_sent_at).getTime()
    : 0;
  if (!sentAt || Date.now() - sentAt > RECOVERY_TOKEN_TTL_MS) {
    throw new MobileApiError(
      "invalid_reset_token",
      "Invalid or expired reset link. Please request a new password reset.",
      400,
    );
  }

  const encryptedPassword = await hashPassword(newPassword);

  await query(
    `UPDATE auth.users
     SET encrypted_password = $1, recovery_token = NULL, recovery_sent_at = NULL, updated_at = NOW()
     WHERE id = $2`,
    [encryptedPassword, authUser.id],
  );

  try {
    const { logPasswordResetCompleted } = await import("@/lib/audit");
    await logPasswordResetCompleted(
      authUser.id,
      request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
      request.headers.get("user-agent") || undefined,
    );
  } catch (logError) {
    console.error("Failed to log password reset completion:", logError);
  }

  return ok({ success: true });
});
