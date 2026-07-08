/**
 * Shared helpers for the mobile form endpoints (contact / newsletter /
 * membership / get-listed). All four persist to the single `form_submissions`
 * table, discriminated by `form_type`. That table's INSERT/UPDATE/DELETE are
 * service_role-only in RLS, so writes MUST use a service-role client - callers
 * pass one in after doing their own validation. Bot protection for the mobile
 * surface is honeypot + per-IP rate limiting (no web reCAPTCHA - a native app
 * can't mint a v3 browser token; decided 2026-06-19).
 */
import type { Database } from "@/types/supabase";
import type { MobileSupabase } from "./supabase";
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
 * `formType` within the last hour. IP lives in `additional_data.ip`; we filter
 * the window in SQL and count matching IPs in JS to keep the query fully typed.
 */
export async function enforceFormRateLimit(
  service: MobileSupabase,
  formType: string,
  ip: string,
  limit: number,
): Promise<void> {
  const since = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  // Filter the IP server-side (JSON `additional_data->>ip`) with an exact count
  // so it stays correct past any row cap, unlike fetch-then-filter-in-JS.
  const { count, error } = await service
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_type", formType)
    .gte("submitted_at", since)
    .filter("additional_data->>ip", "eq", ip);
  if (error) {
    console.error("[mobile-api] form rate-limit query failed:", error.message);
    return; // fail open on a counting error rather than block a legit user
  }
  if ((count ?? 0) >= limit) {
    throw new MobileApiError(
      "rate_limited",
      "Too many submissions. Please try again later.",
      429,
      undefined,
      { retryAfter: 3600 },
    );
  }
}

/** True when a `formType` row already exists for `email` (case-insensitive). */
export async function hasExistingSubmission(
  service: MobileSupabase,
  formType: string,
  email: string,
): Promise<boolean> {
  const { data } = await service
    .from("form_submissions")
    .select("id")
    .eq("form_type", formType)
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  return data != null;
}
