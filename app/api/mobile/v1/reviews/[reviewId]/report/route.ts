import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { createContentReport } from "@/lib/reports/create-report";
import { isReportReason } from "@/lib/reports/reasons";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/reviews/{reviewId}/report
 *
 * Reports a review as spam/inappropriate/etc. Cannot report your own review
 * or report the same review twice - mirrors the mobile helpful-vote route's
 * error shape (app/api/mobile/v1/reviews/[reviewId]/helpful/route.ts).
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await requireMobileUser(request);

  const body = await request.json().catch(() => ({}));
  if (!isReportReason(body.reason)) {
    throw new MobileApiError(
      "validation_error",
      "Please select a valid reason.",
      400,
      "reason",
    );
  }
  if (body.reason === "other" && !String(body.details || "").trim()) {
    throw new MobileApiError(
      "validation_error",
      "Please describe the issue.",
      400,
      "details",
    );
  }

  const result = await createContentReport({
    contentType: "review",
    contentId: reviewId,
    reporterId: user.id,
    reason: body.reason,
    details: body.details,
    ipAddress:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown",
  });

  if (!result.success) {
    if (result.error === "not_found") {
      throw new MobileApiError("not_found", "Review not found.", 404);
    }
    if (result.error === "cannot_report_own_content") {
      throw new MobileApiError(
        "cannot_report_own_content",
        "You can't report your own review.",
        400,
      );
    }
    throw new MobileApiError(
      "already_reported",
      "You've already reported this review.",
      400,
    );
  }

  return ok({ reported: true });
});
