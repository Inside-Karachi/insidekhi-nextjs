import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/notifications/mark-all
 *
 * Marks all of the caller's unread notifications as read. The old
 * `mark_all_notifications_read` RPC authorized itself via Supabase's
 * `auth.uid()` session GUC, which a direct pg connection never sets - so the
 * `recipient_id` filter below is what enforces "only your own notifications".
 * Exposed as POST per the v1 contract (the website route is PATCH).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  let updated: number;
  try {
    const { rows } = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, timezone('utc', now())),
           updated_at = timezone('utc', now())
       WHERE recipient_id = $1 AND read_at IS NULL
       RETURNING id`,
      [user.id],
    );
    updated = rows.length;
  } catch (error) {
    console.error("[mobile-api] mark-all-notifications failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to update notifications.",
      500,
    );
  }

  const isProd = process.env.NODE_ENV === "production";
  const unreadSql = isProd
    ? `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL AND (metadata->>'demo' IS NULL OR metadata->>'demo' != 'true')`
    : `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL`;
  const { rows: unreadRows } = await query(unreadSql, [user.id]);
  const unreadCount = parseInt(unreadRows[0].count, 10);

  return ok({
    success: true,
    updated,
    unread_count: unreadCount,
  });
});
