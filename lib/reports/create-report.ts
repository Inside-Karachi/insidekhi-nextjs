import { query } from "@/lib/db";
import {
  createNotification,
  resolveCategorySlugForRole,
  dispatchEmailOutboxBatch,
} from "@/lib/notifications";
import type { NotificationUserRole } from "@/types/notifications.types";
import type { ReportContentType, ReportReason } from "./reasons";

type CreateReportInput = {
  contentType: ReportContentType;
  contentId: number;
  reporterId: string;
  reason: ReportReason;
  details?: string | null;
  ipAddress?: string;
};

type CreateReportResult =
  | { success: true }
  | {
      success: false;
      error: "not_found" | "cannot_report_own_content" | "already_reported";
    };

const CONTENT_TABLE: Record<ReportContentType, string> = {
  review: "reviews",
  comment: "review_comments",
};

/**
 * Reports a review or comment as spam/inappropriate/etc. Mirrors the
 * auth -> self-block -> duplicate-check -> insert shape already established
 * for review helpful-votes (app/api/reviews/[reviewId]/helpful/route.ts),
 * backed by `content_reports` instead of `helpful_reviews`. Used by both the
 * web and mobile report routes.
 */
export async function createContentReport(
  input: CreateReportInput,
): Promise<CreateReportResult> {
  const { contentType, contentId, reporterId, reason, details, ipAddress } =
    input;

  const { rows } = await query(
    `SELECT user_id FROM ${CONTENT_TABLE[contentType]} WHERE id = $1`,
    [contentId],
  );
  const ownerId = rows[0]?.user_id as string | undefined;

  if (!ownerId) {
    return { success: false, error: "not_found" };
  }

  if (ownerId === reporterId) {
    return { success: false, error: "cannot_report_own_content" };
  }

  try {
    await query(
      `INSERT INTO public.content_reports (content_type, content_id, reporter_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [contentType, contentId, reporterId, reason, details || null],
    );
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return { success: false, error: "already_reported" };
    }
    throw error;
  }

  try {
    const { logContentReport } = await import("@/lib/audit");
    await logContentReport(reporterId, contentType, contentId, reason, ipAddress);
  } catch (err) {
    console.error("[create-report] audit log failed (non-fatal):", err);
  }

  // Notify staff, deduped per content item (not per report) so repeated
  // reports on the same review/comment only page staff once.
  try {
    const { rows: recipients } = await query(
      `SELECT id, role FROM profiles WHERE role::text = ANY($1::text[])`,
      [["super_admin", "admin", "lister"]],
    );

    if (recipients.length) {
      const categoryCache = new Map<NotificationUserRole, string>();
      const label = contentType === "review" ? "review" : "comment";

      await Promise.allSettled(
        recipients.map(async (recipient) => {
          const role = recipient.role as NotificationUserRole;
          if (!categoryCache.has(role)) {
            categoryCache.set(role, await resolveCategorySlugForRole(role));
          }
          await createNotification({
            recipientId: recipient.id,
            roleScope: role,
            categorySlug: categoryCache.get(role)!,
            title: `New ${label} report`,
            body: `A ${label} was reported for: ${reason}`,
            metadata: { contentType, contentId, reason },
            priority: "normal",
            ctaLabel: "Review report",
            ctaUrl: "/admin/reports",
            dedupeKey: `report-${contentType}-${contentId}`,
          });
        }),
      );

      try {
        await dispatchEmailOutboxBatch({});
      } catch (dispatchError) {
        console.error("[create-report] notification dispatch failed:", dispatchError);
      }
    }
  } catch (err) {
    console.error("[create-report] notification queue failed (non-fatal):", err);
  }

  return { success: true };
}
