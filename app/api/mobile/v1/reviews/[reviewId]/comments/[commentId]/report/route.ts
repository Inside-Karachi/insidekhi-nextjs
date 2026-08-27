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
 * POST /api/mobile/v1/reviews/{reviewId}/comments/{commentId}/report
 *
 * Reports a comment as spam/inappropriate/etc. Mirrors the review report
 * route (app/api/mobile/v1/reviews/[reviewId]/report/route.ts).
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const commentId = parsePathId((await params).commentId, "commentId");
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
    contentType: "comment",
    contentId: commentId,
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
      throw new MobileApiError("not_found", "Comment not found.", 404);
    }
    if (result.error === "cannot_report_own_content") {
      throw new MobileApiError(
        "cannot_report_own_content",
        "You can't report your own comment.",
        400,
      );
    }
    throw new MobileApiError(
      "already_reported",
      "You've already reported this comment.",
      400,
    );
  }

  return ok({ reported: true });
});
