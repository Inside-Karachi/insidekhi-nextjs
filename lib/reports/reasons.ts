/**
 * Report reasons for flagging a review or comment, adapted from Instagram's
 * own content-report categories for a text-only review context (dropping
 * the media-specific ones like nudity/violence-imagery that don't apply to
 * a written review or comment). Shared between the web and mobile UIs and
 * the API routes so the reason list can't drift between them.
 */
export const REPORT_REASONS = [
  { value: "spam", label: "It's spam" },
  { value: "hate_speech", label: "Hate speech or symbols" },
  { value: "harassment", label: "Bullying or harassment" },
  { value: "false_information", label: "False information" },
  { value: "scam", label: "Scam or fraud" },
  { value: "inappropriate", label: "Inappropriate or offensive content" },
  { value: "illegal_goods", label: "Sale of illegal or regulated goods" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_REASON_VALUES = REPORT_REASONS.map((r) => r.value);

export function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === "string" &&
    (REPORT_REASON_VALUES as string[]).includes(value)
  );
}

export type ReportContentType = "review" | "comment";
