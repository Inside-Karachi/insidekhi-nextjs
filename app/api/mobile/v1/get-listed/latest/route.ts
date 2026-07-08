import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  toFormSubmission,
  FORM_SUBMISSION_COLUMNS,
  type FormSubmissionRow,
} from "@/lib/mobile/forms";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/get-listed/latest
 *
 * The caller's most recent "get listed" application (or `null`). Scoped to the
 * user via RLS (`uploaded_by = auth.uid()`). Unlike the website route, there is
 * no signed-receipt/id lookup path - mobile retrieval is by the authenticated
 * user only.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);

  const { data, error } = await supabase
    .from("form_submissions")
    .select(FORM_SUBMISSION_COLUMNS)
    .eq("form_type", "get-listed")
    .eq("uploaded_by", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .returns<FormSubmissionRow[]>()
    .maybeSingle();
  if (error) {
    console.error("[mobile-api] get-listed latest failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load application.",
      500,
    );
  }

  return ok(data ? toFormSubmission(data) : null);
});
