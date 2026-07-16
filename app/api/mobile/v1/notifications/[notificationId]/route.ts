import { createServerSupabase } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { getUnreadCount } from "@/lib/notifications";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/mobile/v1/notifications/{id}
 *
 * Marks the caller's notification read; `{ "archive": true }` archives it. IDs
 * are UUIDs (not integers). Ownership is enforced by the SECURITY INVOKER RPC
 * `mark_notification_read`, which raises (42501) if the row isn't the caller's -
 * mapped to 404 (no existence disclosure). Mirrors
 * `app/api/notifications/[notificationId]` (PATCH).
 */
export const PATCH = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
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

  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
    p_archive: archive,
  });
  if (error) {
    // RPC raises P0002 (not found) - and under the caller's RLS another user's
    // row is invisible so it also surfaces as P0002 - or 42501 (not authorized).
    // Both mean "not the caller's notification" -> 404 (no existence disclosure).
    if (error.code === "P0002" || error.code === "42501") {
      throw new MobileApiError("not_found", "Notification not found.", 404);
    }
    console.error("[mobile-api] mark_notification_read failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to update notification.",
      500,
    );
  }

  const { unreadCount } = await getUnreadCount(supabase, user.id, {
    excludeDemo: process.env.NODE_ENV === "production",
  });

  return ok({ success: true, unread_count: unreadCount });
});
