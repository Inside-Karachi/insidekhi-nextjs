import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { toFormSubmission, FORM_SUBMISSION_COLUMNS } from "@/lib/mobile/forms";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/get-listed/latest
 *
 * The caller's most recent "get listed" application (or `null`). Scoped to the
 * user via an explicit `uploaded_by` filter. Unlike the website route, there is
 * no signed-receipt/id lookup path - mobile retrieval is by the authenticated
 * user only.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  let rows;
  try {
    const result = await query(
      `SELECT ${FORM_SUBMISSION_COLUMNS}
       FROM form_submissions
       WHERE form_type = $1 AND uploaded_by = $2
       ORDER BY submitted_at DESC
       LIMIT 1`,
      ["get-listed", user.id],
    );
    rows = result.rows;
  } catch (error) {
    console.error(
      "[mobile-api] get-listed latest failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load application.",
      500,
    );
  }

  return ok(rows[0] ? toFormSubmission(rows[0]) : null);
});
