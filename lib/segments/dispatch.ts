import { query } from "@/lib/db";
import { createNotification, resolveCategorySlugForRole } from "@/lib/notifications";
import type {
  NotificationPriority,
  NotificationUserRole,
} from "@/types/notifications.types";

/**
 * Wires a segment into the existing notification outbox
 * (lib/notifications/service.ts createNotification - Brevo email + Expo
 * push are the only async channels; there is no SMS/WhatsApp channel).
 *
 * Deliberately NOT called automatically by the nightly refresh route
 * (app/api/cron/refresh-segments) - blasting every member of every segment
 * every night would spam users. This is exposed as a callable helper for
 * something else (a future admin action, or a specific scheduled
 * evaluator) to invoke deliberately for one segment at a time.
 */

export interface NotifySegmentOptions {
  segmentSlug: string;
  title: string;
  body: string;
  priority?: NotificationPriority;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Defaults to resolving the best category for each recipient's role (falling back to "general"). */
  categorySlug?: string;
  /** Combined with segment_slug + recipient + day into the dedupe key, so re-invoking the same day for the same segment does not double-send. */
  dedupeKeyPrefix?: string;
}

export interface NotifySegmentResult {
  segmentSlug: string;
  recipientCount: number;
  sent: number;
  failed: number;
}

export async function notifySegment(
  options: NotifySegmentOptions
): Promise<NotifySegmentResult> {
  const { rows } = await query(
    `SELECT sm.user_id, p.role
     FROM public.segment_membership sm
     JOIN public.profiles p ON p.id = sm.user_id
     WHERE sm.segment_slug = $1`,
    [options.segmentSlug]
  );

  let sent = 0;
  let failed = 0;
  const dedupeDate = new Date().toISOString().slice(0, 10);

  for (const row of rows as { user_id: string; role: NotificationUserRole }[]) {
    try {
      const categorySlug =
        options.categorySlug ??
        (await resolveCategorySlugForRole(row.role, "general"));

      await createNotification({
        recipientId: row.user_id,
        roleScope: row.role,
        categorySlug,
        title: options.title,
        body: options.body,
        priority: options.priority ?? "normal",
        ctaLabel: options.ctaLabel,
        ctaUrl: options.ctaUrl,
        dedupeKey: `${options.dedupeKeyPrefix ?? "segment"}:${options.segmentSlug}:${row.user_id}:${dedupeDate}`,
        metadata: { segment_slug: options.segmentSlug },
      });
      sent += 1;
    } catch (error) {
      console.error(
        `notifySegment: failed to notify user ${row.user_id} for segment ${options.segmentSlug}`,
        error
      );
      failed += 1;
    }
  }

  return {
    segmentSlug: options.segmentSlug,
    recipientCount: rows.length,
    sent,
    failed,
  };
}
