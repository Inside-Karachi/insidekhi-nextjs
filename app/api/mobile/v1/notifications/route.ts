import { createServerSupabase } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { listNotifications, getUnreadCount } from "@/lib/notifications";
import { toNotification } from "@/lib/mobile/mappers";
import type {
  NotificationPriority,
  NotificationFeedStatusFilter,
} from "@/types/notifications.types";
import type { Json } from "@/types/supabase";

export const dynamic = "force-dynamic";

const STATUS = ["all", "unread", "archived"] as const;
const PRIORITIES = ["low", "normal", "high"] as const;

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** True for seeded/sample notifications (`metadata.demo === true`), hidden in prod. */
function isDemoNotification(metadata: Json): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    metadata.demo === true
  );
}

/**
 * GET /api/mobile/v1/notifications
 *
 * Cursor-paginated notification feed for the caller (RLS-scoped to
 * `recipient_id = auth.uid()`). Filters: status/channel/priority/search; cursor
 * is the previous page's `nextCursor`. Mirrors `app/api/notifications` (GET),
 * normalized into the mobile DTO (no `actor_id`/category/channel-internals);
 * `meta` carries `hasMore`, `nextCursor`, `unreadCount`. Demo rows are hidden in
 * production.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  // The cursor is a `triggered_at` ISO timestamp; reject a malformed one with a
  // 400 rather than letting it 500 deep in the timestamp comparison.
  if (cursor !== null && Number.isNaN(Date.parse(cursor))) {
    throw new MobileApiError(
      "validation_error",
      "Invalid cursor.",
      400,
      "cursor",
    );
  }
  const limitRaw = Number(searchParams.get("limit"));
  const limit =
    Number.isInteger(limitRaw) && limitRaw >= 1
      ? Math.min(limitRaw, 100)
      : undefined;
  const status = oneOf<NotificationFeedStatusFilter>(
    searchParams.get("status"),
    STATUS,
  );
  const priority = oneOf<NotificationPriority>(
    searchParams.get("priority"),
    PRIORITIES,
  );
  const rawSearch = searchParams.get("search");
  // Strip PostgREST .or() grammar chars so a search term can't alter the filter
  // (it's RLS-scoped to the caller's own rows regardless, but fail-safe).
  const search =
    rawSearch && rawSearch.trim()
      ? rawSearch.trim().replace(/[(),]/g, " ")
      : undefined;

  const list = await listNotifications(supabase, {
    profileId: user.id,
    cursor,
    limit,
    status,
    priority,
    search,
  });

  const isProd = process.env.NODE_ENV === "production";
  const items = isProd
    ? list.notifications.filter((n) => !isDemoNotification(n.metadata))
    : list.notifications;

  const { unreadCount } = await getUnreadCount(supabase, user.id, {
    excludeDemo: isProd,
  });

  return ok(
    items.map((n) => toNotification(n)),
    {
      hasMore: list.hasMore,
      nextCursor: list.nextCursor,
      unreadCount,
    },
  );
});
