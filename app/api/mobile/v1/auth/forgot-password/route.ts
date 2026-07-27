import { type NextRequest } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().email() });

/**
 * POST /api/mobile/v1/auth/forgot-password  (unauthenticated)
 *
 * Requests a password-reset link. Enumeration-safe: identical `{ sent: true }`
 * response regardless of whether the address exists. Mirrors
 * `app/api/auth/reset-password` (the web "request" route — mobile just uses a
 * clearer route name since it also has a distinct `/reset-password` route for
 * the "confirm" step, unlike the web's nested `/reset-password/confirm`).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A valid email is required.",
      400,
      "email",
    );
  }
  const email = parsed.data.email.trim().toLowerCase();

  try {
    const { rows: users } = await query(
      "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email],
    );

    if (users.length > 0) {
      const user = users[0];
      const recoveryToken = uuidv4();
      const now = new Date().toISOString();

      await query(
        `UPDATE auth.users
         SET recovery_token = $1, recovery_sent_at = $2
         WHERE id = $3`,
        [recoveryToken, now, user.id],
      );

      // TODO: send this link via email once email delivery is wired up
      // (same gap as the web route this mirrors).
      const baseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      ).replace(/\/+$/, "");
      console.log(
        `[MOBILE PASSWORD RESET LINK]: ${baseUrl}/reset-password?code=${recoveryToken}`,
      );
    }

    try {
      const { logPasswordResetRequest } = await import("@/lib/audit");
      await logPasswordResetRequest(
        email,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log password reset request:", logError);
    }
  } catch (error) {
    console.error(
      "[mobile-api] forgot-password failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return ok({ sent: true });
});
