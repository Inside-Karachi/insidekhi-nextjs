import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createContentReport } from "@/lib/reports/create-report";
import { isReportReason } from "@/lib/reports/reasons";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { reviewId } = await params;
    const parsedReviewId = parseInt(reviewId, 10);
    if (isNaN(parsedReviewId)) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!isReportReason(body.reason)) {
      return NextResponse.json(
        { success: false, error: "Please select a valid reason" },
        { status: 400 },
      );
    }
    if (body.reason === "other" && !String(body.details || "").trim()) {
      return NextResponse.json(
        { success: false, error: "Please describe the issue" },
        { status: 400 },
      );
    }

    const result = await createContentReport({
      contentType: "review",
      contentId: parsedReviewId,
      reporterId: session.userId,
      reason: body.reason,
      details: body.details,
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
    });

    if (!result.success) {
      const status = result.error === "not_found" ? 404 : 400;
      const message =
        result.error === "not_found"
          ? "Review not found"
          : result.error === "cannot_report_own_content"
            ? "You can't report your own review"
            : "You've already reported this review";
      return NextResponse.json({ success: false, error: message }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/reviews/[reviewId]/report error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
