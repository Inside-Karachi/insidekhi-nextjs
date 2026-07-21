import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  getClientIp,
  isHoneypotTripped,
  toFormSubmission,
  FORM_SUBMISSION_COLUMNS,
} from "@/lib/mobile/forms";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
  sanitizeString,
  normalizePakPhone,
} from "@/lib/utils/form-utils";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_BUSINESS_TYPES = [
  "Restaurant & Food",
  "Hotel & Accommodation",
  "Event Management",
  "Entertainment & Leisure",
  "Shopping & Retail",
  "Fitness & Healthcare",
  "Education & Training",
  "Professional Services",
  "Other",
];

/**
 * GET /api/mobile/v1/membership
 *
 * The caller's own membership applications (empty when unauthenticated).
 * Explicitly scoped to `uploaded_by = <caller>`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await getOptionalMobileUser(request);
  if (!user) return ok([]);

  let rows;
  try {
    const result = await query(
      `SELECT ${FORM_SUBMISSION_COLUMNS}
       FROM form_submissions
       WHERE form_type = $1 AND uploaded_by = $2
       ORDER BY submitted_at DESC
       LIMIT 50`,
      ["membership", user.id],
    );
    rows = result.rows;
  } catch (error) {
    console.error(
      "[mobile-api] membership list failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load applications.",
      500,
    );
  }
  return ok(rows.map(toFormSubmission));
});

const bodySchema = z.object({
  companyName: z.string(),
  email: z.string(),
  contactName: z.string(),
  businessType: z.string(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  yearsInBusiness: z.string().optional(),
  interests: z.string().optional(),
  website_confirm: z.string().optional(), // honeypot
});

function validWebsite(raw: string | null): boolean {
  if (!raw) return true;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

/**
 * POST /api/mobile/v1/membership
 *
 * Submit a membership/business application (optional auth; stamps `uploaded_by`
 * when signed in). Honeypot + per-IP rate limit (10/hr); duplicate email ->
 * idempotent success. Mirrors `app/api/membership` (POST), minus reCAPTCHA and
 * the web receipt cookie.
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

  const companyName = sanitizeString(parsed.data.companyName, 255);
  const contactName = sanitizeString(parsed.data.contactName, 255);
  const email = normalizeEmail(parsed.data.email);
  const businessType = sanitizeString(parsed.data.businessType, 100) ?? "";
  if (!companyName)
    throw new MobileApiError(
      "validation_error",
      "Company name is required.",
      400,
      "companyName",
    );
  if (!contactName)
    throw new MobileApiError(
      "validation_error",
      "Contact name is required.",
      400,
      "contactName",
    );
  if (!validateEmail(email))
    throw new MobileApiError(
      "validation_error",
      "A valid email is required.",
      400,
      "email",
    );
  if (!ALLOWED_BUSINESS_TYPES.includes(businessType)) {
    throw new MobileApiError(
      "validation_error",
      "Invalid business type.",
      400,
      "businessType",
    );
  }

  const phone = normalizePakPhone(parsed.data.phone);
  if (parsed.data.phone && !phone) {
    throw new MobileApiError(
      "validation_error",
      "Invalid Pakistan phone number format.",
      400,
      "phone",
    );
  }
  const website = sanitizeString(parsed.data.website, 255);
  if (!validWebsite(website)) {
    throw new MobileApiError(
      "validation_error",
      "Invalid website URL.",
      400,
      "website",
    );
  }

  const ip = getClientIp(request);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM form_submissions
     WHERE form_type = $1 AND submitted_at >= $2 AND additional_data->>'ip' = $3`,
    ["membership", since, ip],
  );
  if ((countRows[0]?.count ?? 0) >= 10) {
    throw new MobileApiError(
      "rate_limited",
      "Too many submissions. Please try again later.",
      429,
      undefined,
      { retryAfter: 3600 },
    );
  }

  if (isDisposableEmail(email)) {
    throw new MobileApiError(
      "validation_error",
      "Disposable email addresses are not allowed.",
      400,
      "email",
    );
  }

  const { rows: existingRows } = await query(
    `SELECT id FROM form_submissions WHERE form_type = $1 AND email = $2 LIMIT 1`,
    ["membership", email],
  );
  if (existingRows.length > 0) {
    return ok({ submitted: true }); // already applied
  }

  const { user } = await getOptionalMobileUser(request);
  try {
    await query(
      `INSERT INTO form_submissions
         (form_type, name, email, phone, company_name, business_type, address,
          city, state, zip_code, website, years_in_business, message,
          uploaded_by, additional_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        "membership",
        contactName,
        email,
        phone,
        companyName,
        businessType,
        sanitizeString(parsed.data.address, 1000),
        sanitizeString(parsed.data.city, 100),
        sanitizeString(parsed.data.state, 100),
        sanitizeString(parsed.data.zipCode, 20),
        website || null,
        sanitizeString(parsed.data.yearsInBusiness, 50),
        sanitizeString(parsed.data.interests, 2000),
        user?.id ?? null,
        JSON.stringify({ formVersion: "1.0", submittedFrom: "mobile", ip }),
      ],
    );
  } catch (error) {
    console.error(
      "[mobile-api] membership insert failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to submit application.",
      500,
    );
  }

  // Opaque response (same for new vs already-applied) so an unauthenticated
  // caller can't probe whether an email already has a membership application.
  return ok({ submitted: true }, undefined, { status: 201 });
});
