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
  toFormSubmission,
  FORM_SUBMISSION_COLUMNS,
  type FormSubmissionRow,
} from "@/lib/mobile/forms";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
  sanitizeString,
  normalizePakPhone,
} from "@/lib/utils/form-utils";

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
 * The caller's own membership applications (empty when unauthenticated). RLS
 * scopes `form_submissions` SELECT to `uploaded_by = auth.uid()`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await getOptionalMobileUser(request);
  if (!user) return ok([]);

  const { data, error } = await supabase
    .from("form_submissions")
    .select(FORM_SUBMISSION_COLUMNS)
    .eq("form_type", "membership")
    .eq("uploaded_by", user.id)
    .order("submitted_at", { ascending: false })
    .limit(50)
    .returns<FormSubmissionRow[]>();
  if (error) {
    console.error("[mobile-api] membership list failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load applications.",
      500,
    );
  }
  return ok((data ?? []).map(toFormSubmission));
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
  const service = createMobileServiceClient();
  await enforceFormRateLimit(service, "membership", ip, 10);
  if (isDisposableEmail(email)) {
    throw new MobileApiError(
      "validation_error",
      "Disposable email addresses are not allowed.",
      400,
      "email",
    );
  }
  if (await hasExistingSubmission(service, "membership", email)) {
    return ok({ submitted: true }); // already applied
  }

  const { user } = await getOptionalMobileUser(request);
  const { error } = await service.from("form_submissions").insert({
    form_type: "membership",
    name: contactName,
    email,
    phone,
    company_name: companyName,
    business_type: businessType,
    address: sanitizeString(parsed.data.address, 1000),
    city: sanitizeString(parsed.data.city, 100),
    state: sanitizeString(parsed.data.state, 100),
    zip_code: sanitizeString(parsed.data.zipCode, 20),
    website: website || null,
    years_in_business: sanitizeString(parsed.data.yearsInBusiness, 50),
    message: sanitizeString(parsed.data.interests, 2000),
    uploaded_by: user?.id ?? null,
    additional_data: { formVersion: "1.0", submittedFrom: "mobile", ip },
  });
  if (error) {
    console.error("[mobile-api] membership insert failed:", error.message);
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
