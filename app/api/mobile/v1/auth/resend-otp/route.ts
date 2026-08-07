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
import { createAndSendSignupOtp } from "@/lib/auth/otp";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().email() });

/**
 * POST /api/mobile/v1/auth/resend-otp  (unauthenticated)
 *
 * Resends the signup verification code. IP rate limited, plus 3/hour/email.
 * Responds `{ sent: true }` opaquely regardless of whether the address exists
 * or is already confirmed, so it can't be used to probe registered accounts.
 * Mirrors `app/api/auth/resend-otp`.
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

  try {
    const { rows } = await query(
      `SELECT u.id, p.full_name
       FROM auth.users u
       JOIN public.profiles p ON p.id = u.id
       WHERE LOWER(u.email) = LOWER($1) AND u.email_confirmed_at IS NULL
       LIMIT 1`,
      [email],
    );
    const user = rows[0];

    if (user) {
      await createAndSendSignupOtp({
        userId: user.id,
        email,
        fullName: user.full_name,
      });
    }
  } catch (error) {
    console.error(
      "[mobile-api] resend-otp failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return ok({ sent: true });
});
