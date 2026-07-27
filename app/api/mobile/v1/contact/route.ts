import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  getClientIp,
  isHoneypotTripped,
  enforceFormRateLimit,
} from "@/lib/mobile/forms";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
  sanitizeString,
  normalizePakPhone,
} from "@/lib/utils/form-utils";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string(),
  email: z.string(),
  message: z.string(),
  subject: z.string().optional(),
  phone: z.string().optional(),
  website_confirm: z.string().optional(), // honeypot
});

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/mobile/v1/contact
 *
 * General "contact us" message. Honeypot + rate limits (20/IP/hr and 5/email per
 * 24h); a same email+subject within 24h is treated as already submitted
 * (idempotent). Mirrors the `contact-us` branch of `app/api/contact` (POST),
 * minus the web reCAPTCHA. Admins read submissions from the form_submissions
 * table; mobile-originated contacts are not separately push-notified in v1.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError("validation_error", "Invalid request.", 400);
  }
  if (isHoneypotTripped(parsed.data.website_confirm)) {
    return ok({ submitted: true });
  }

  const name = sanitizeString(parsed.data.name, 100);
  const email = normalizeEmail(parsed.data.email);
  const message = sanitizeString(parsed.data.message, 5000);
  const subject = sanitizeString(parsed.data.subject, 200) ?? "";
  if (!name)
    throw new MobileApiError(
      "validation_error",
      "Name is required.",
      400,
      "name",
    );
  if (!validateEmail(email))
    throw new MobileApiError(
      "validation_error",
      "A valid email is required.",
      400,
      "email",
    );
  if (!message)
    throw new MobileApiError(
      "validation_error",
      "Message is required.",
      400,
      "message",
    );

  const ip = getClientIp(request);
  await enforceFormRateLimit("contact-us", ip, 20);
  if (isDisposableEmail(email)) {
    throw new MobileApiError(
      "validation_error",
      "Disposable email addresses are not allowed.",
      400,
      "email",
    );
  }

  // Per-email 24h activity: cap at 5/day and dedupe an identical subject.
  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
  let recentRows: { additional_data: unknown }[] = [];
  try {
    const { rows } = await query(
      `SELECT additional_data FROM form_submissions
       WHERE form_type = 'contact-us' AND email = $1 AND submitted_at >= $2
       LIMIT 50`,
      [email, since],
    );
    recentRows = rows;
  } catch (recentErr) {
    // Fail open (don't block a legit message) but surface the silent bypass.
    console.error(
      "[mobile-api] contact recent-activity query failed:",
      recentErr,
    );
  }
  if (recentRows.length >= 5) {
    throw new MobileApiError(
      "rate_limited",
      "Too many messages from this email. Please try again later.",
      429,
      undefined,
      { retryAfter: 86400 }, // this cap is over a 24h window, not 1h
    );
  }
  // Only dedupe a non-empty subject - distinct blank-subject messages must not
  // collapse to one.
  const duplicate =
    subject.length > 0 &&
    recentRows.some(
      (r) =>
        (r.additional_data as { subject?: string } | null)?.subject === subject,
    );
  if (duplicate) {
    return ok({ submitted: true }); // a similar message was already received
  }

  const { user } = await getOptionalMobileUser(request);
  const phone = normalizePakPhone(parsed.data.phone);
  const additionalData = {
    subject,
    source: "mobile",
    ip,
    user_id: user?.id ?? null,
  };
  try {
    await query(
      `INSERT INTO form_submissions (form_type, name, email, phone, message, status, uploaded_by, additional_data)
       VALUES ('contact-us', $1, $2, $3, $4, 'pending', $5, $6)`,
      [name, email, phone, message, user?.id ?? null, additionalData],
    );
  } catch (error) {
    console.error("[mobile-api] contact insert failed:", error);
    throw new MobileApiError("internal_error", "Failed to send message.", 500);
  }

  return ok({ submitted: true }, undefined, { status: 201 });
});
