import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/mobile/v1/notifications/{id}
 *
 * Marks the caller's notification read; `{ "archive": true }` archives it. IDs
 * are UUIDs (not integers). The old `mark_notification_read` RPC authorized
 * itself via Supabase's `auth.uid()` session GUC, which a direct pg
 * connection never sets - so the `recipient_id` filter below is what enforces
 * ownership; a zero-row update (not found or not yours) maps to 404 (no
 * existence disclosure), matching the RPC's prior behavior. Mirrors
 * `app/api/notifications/[notificationId]` (PATCH).
 */
export const PATCH = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const notificationId = (await params).notificationId;
  if (!notificationId || !UUID_RE.test(notificationId)) {
    throw new MobileApiError(
      "validation_error",
      "Invalid notification id.",
      400,
      "id",
    );
  }

  let archive = false;
  try {
    const body = await request.json();
    if (body && typeof body.archive === "boolean") archive = body.archive;
  } catch {
    // no/empty body -> mark read
  }

  let rowCount: number;
  try {
    const { rows } = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, timezone('utc', now())),
           archived_at = CASE WHEN $1 THEN COALESCE(archived_at, timezone('utc', now())) ELSE archived_at END,
           updated_at = timezone('utc', now())
       WHERE id = $2 AND recipient_id = $3
       RETURNING id`,
      [archive, notificationId, user.id],
    );
    rowCount = rows.length;
  } catch (error) {
    console.error("[mobile-api] mark_notification_read failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to update notification.",
      500,
    );
  }

  if (rowCount === 0) {
    throw new MobileApiError("not_found", "Notification not found.", 404);
  }

  const isProd = process.env.NODE_ENV === "production";
  const unreadSql = isProd
    ? `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL AND (metadata->>'demo' IS NULL OR metadata->>'demo' != 'true')`
    : `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL`;
  const { rows: unreadRows } = await query(unreadSql, [user.id]);
  const unreadCount = parseInt(unreadRows[0].count, 10);

  return ok({ success: true, unread_count: unreadCount });
});
