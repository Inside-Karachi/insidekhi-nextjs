import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import {
  enforceMobileRateLimit,
  enforceResendVerificationLimit,
} from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().email() });

/**
 * POST /api/mobile/v1/auth/resend-verification  (unauthenticated)
 *
 * Resends the signup confirmation email. IP rate limited, plus 3/hour/email.
 * Responds `{ sent: true }` opaquely regardless of whether the address exists or
 * is already confirmed, so it can't be used to probe registered accounts.
 * Mirrors `app/api/auth/resend-verification`.
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

  await enforceResendVerificationLimit(email);

  // Enumeration-safe: identical `{ sent: true }` response regardless of
  // whether the address exists or is already confirmed; only unexpected DB
  // errors are logged. Mirrors `app/api/auth/resend-verification`.
  try {
    const { rows } = await query(
      `SELECT id, email_confirmed_at FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );
    const user = rows[0];

    if (user && !user.email_confirmed_at) {
      const confirmationToken = uuidv4();
      const now = new Date().toISOString();

      await query(
        `UPDATE auth.users SET confirmation_token = $1, confirmation_sent_at = $2 WHERE id = $3`,
        [confirmationToken, now, user.id],
      );

      const baseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      ).replace(/\/+$/, "");
      console.log(
        `[VERIFICATION EMAIL LINK]: ${baseUrl}/api/auth/callback?token=${confirmationToken}`,
      );
    }
  } catch (error) {
    console.error(
      "[mobile-api] resend-verification failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return ok({ sent: true });
});
