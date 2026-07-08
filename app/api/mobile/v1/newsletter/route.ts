import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { createMobileServiceClient } from "@/lib/mobile/supabase";
import {
  getClientIp,
  isHoneypotTripped,
  enforceFormRateLimit,
  hasExistingSubmission,
} from "@/lib/mobile/forms";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
} from "@/lib/utils/form-utils";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string(),
  interests: z.array(z.string()).optional(),
  website_confirm: z.string().optional(), // honeypot
});

/**
 * POST /api/mobile/v1/newsletter
 *
 * Email newsletter subscription. Optional auth (stamps `uploaded_by` when a
 * token is present). Honeypot + per-IP rate limit (50/hr); duplicate emails are
 * treated as success (idempotent). Mirrors `app/api/newsletter` (POST).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError("validation_error", "Invalid request.", 400);
  }
  // Honeypot tripped -> pretend success without writing anything.
  if (isHoneypotTripped(parsed.data.website_confirm)) {
    return ok({ subscribed: true });
  }

  const email = normalizeEmail(parsed.data.email);
  if (!validateEmail(email)) {
    throw new MobileApiError(
      "validation_error",
      "A valid email is required.",
      400,
      "email",
    );
  }

  const ip = getClientIp(request);
  const service = createMobileServiceClient();
  await enforceFormRateLimit(service, "newsletter", ip, 50);

  if (isDisposableEmail(email)) {
    throw new MobileApiError(
      "validation_error",
      "Disposable email addresses are not allowed.",
      400,
      "email",
    );
  }

  // Idempotent: already subscribed -> success.
  if (await hasExistingSubmission(service, "newsletter", email)) {
    return ok({ subscribed: true });
  }

  const { user } = await getOptionalMobileUser(request);
  const { error } = await service.from("form_submissions").insert({
    form_type: "newsletter",
    email,
    status: "n/a",
    uploaded_by: user?.id ?? null,
    additional_data: {
      interests: parsed.data.interests ?? [],
      source: "mobile",
      ip,
      subscribedAt: new Date().toISOString(),
    },
  });
  if (error) {
    console.error("[mobile-api] newsletter insert failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to subscribe.", 500);
  }

  return ok({ subscribed: true }, undefined, { status: 201 });
});
