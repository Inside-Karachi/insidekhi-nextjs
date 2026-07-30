/**
 * Shared helpers for the mobile form endpoints (contact / newsletter /
 * membership / get-listed). All four persist to the single `form_submissions`
 * table, discriminated by `form_type`. Bot protection for the mobile surface is
 * honeypot + per-IP rate limiting (no web reCAPTCHA - a native app can't mint a
 * v3 browser token; decided 2026-06-19).
 */
import type { Database } from "@/types/database";
import { query } from "@/lib/db";
import { MobileApiError } from "./errors";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Public DTO for a form submission returned to its own author. Deliberately
 * excludes `reviewer_notes` (internal admin commentary) and the raw contact PII
 * columns beyond what the author already provided.
 */
export type FormSubmissionDTO = {
  id: number;
  form_type: string;
  status: string | null;
  company_name: string | null;
  business_type: string | null;
  email: string;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export type FormSubmissionRow = Pick<
  Database["public"]["Tables"]["form_submissions"]["Row"],
  | "id"
  | "form_type"
  | "status"
  | "company_name"
  | "business_type"
  | "email"
  | "submitted_at"
  | "reviewed_at"
>;

export const FORM_SUBMISSION_COLUMNS =
  "id, form_type, status, company_name, business_type, email, submitted_at, reviewed_at";

export function toFormSubmission(row: FormSubmissionRow): FormSubmissionDTO {
  return {
    id: row.id,
    form_type: row.form_type,
    status: row.status,
    company_name: row.company_name,
    business_type: row.business_type,
    email: row.email,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
  };
}

/** Client IP from proxy headers; "unknown" when absent (matches the website). */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Honeypot: bots fill hidden fields. A non-empty `website_confirm` means a bot -
 * the caller should return a fake success (don't reveal the trap).
 */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Throws `rate_limited` (429) when `ip` has submitted >= `limit` rows of
 * `formType` within the last hour. IP lives in `additional_data.ip`.
 */
export async function enforceFormRateLimit(
  formType: string,
  ip: string,
  limit: number,
): Promise<void> {
  const since = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  let count = 0;
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM form_submissions
       WHERE form_type = $1 AND submitted_at >= $2 AND additional_data->>'ip' = $3`,
      [formType, since, ip],
    );
    count = rows[0]?.count ?? 0;
  } catch (error) {
    console.error("[mobile-api] form rate-limit query failed:", error);
    return; // fail open on a counting error rather than block a legit user
  }
  if (count >= limit) {
    throw new MobileApiError(
      "rate_limited",
      "Too many submissions. Please try again later.",
      429,
      undefined,
      { retryAfter: 3600 },
    );
  }
}

/** True when a `formType` row already exists for `email`. */
export async function hasExistingSubmission(
  formType: string,
  email: string,
): Promise<boolean> {
  const { rows } = await query(
    `SELECT id FROM form_submissions WHERE form_type = $1 AND email = $2 LIMIT 1`,
    [formType, email],
  );
  return rows.length > 0;
}
