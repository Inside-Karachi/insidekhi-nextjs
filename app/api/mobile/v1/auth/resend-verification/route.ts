import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import {
  enforceMobileRateLimit,
  enforceResendVerificationLimit,
} from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { createMobilePublicClient } from "@/lib/mobile/supabase";

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

  // No `emailRedirectTo`: the confirmation link uses the Supabase project's
  // default Site URL (the web confirm page). A mobile deep-link target can be
  // added here once the app defines its universal link.
  const supabase = createMobilePublicClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  // Swallow "already confirmed / not found"-style errors (enumeration-safe);
  // only log genuinely unexpected failures.
  if (error && !/already|not found|not confirmed/i.test(error.message)) {
    console.error("[mobile-api] resend-verification failed:", error.message);
  }

  return ok({ sent: true });
});
