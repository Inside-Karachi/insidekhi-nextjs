import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { getUnreadCount } from "@/lib/notifications";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/notifications/mark-all
 *
 * Marks all of the caller's unread notifications as read via the SECURITY
 * INVOKER RPC `mark_all_notifications_read` (self-scoped to `auth.uid()`).
 * Exposed as POST per the v1 contract (the website route is PATCH).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { data: updated, error } = await supabase.rpc(
    "mark_all_notifications_read",
    { p_profile_id: user.id },
  );
  if (error) {
    console.error(
      "[mobile-api] mark_all_notifications_read failed:",
      error.message,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to update notifications.",
      500,
    );
  }

  const { unreadCount } = await getUnreadCount(supabase, user.id, {
    excludeDemo: process.env.NODE_ENV === "production",
  });

  return ok({
    success: true,
    updated: updated ?? 0,
    unread_count: unreadCount,
  });
});
