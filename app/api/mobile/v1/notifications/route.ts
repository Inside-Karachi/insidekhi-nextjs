import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { toNotification } from "@/lib/mobile/mappers";
import type {
  NotificationFeedItem,
  NotificationPriority,
  NotificationFeedStatusFilter,
} from "@/types/notifications.types";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS = ["all", "unread", "archived"] as const;
const PRIORITIES = ["low", "normal", "high"] as const;
const FEED_PAGE_SIZE_DEFAULT = 20;

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
 * Cursor-paginated notification feed for the caller (scoped to the token's
 * user id). Filters: status/priority/search; cursor is the previous page's
 * `nextCursor`. Mirrors `app/api/notifications` (GET), normalized into the
 * mobile DTO (no `actor_id`/category/channel-internals); `meta` carries
 * `hasMore`, `nextCursor`, `unreadCount`. Demo rows are hidden in production.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  // The cursor is a `triggered_at` ISO timestamp; reject a malformed one with a
  // 400 rather than letting it fail deep in the timestamp comparison.
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
      : FEED_PAGE_SIZE_DEFAULT;
  const status = oneOf<NotificationFeedStatusFilter>(
    searchParams.get("status"),
    STATUS,
  );
  const priority = oneOf<NotificationPriority>(
    searchParams.get("priority"),
    PRIORITIES,
  );
  const rawSearch = searchParams.get("search");
  const search =
    rawSearch && rawSearch.trim() ? rawSearch.trim() : undefined;

  const whereClauses: string[] = ["n.recipient_id = $1"];
  const params: unknown[] = [user.id];

  if (status === "archived") {
    whereClauses.push("n.archived_at IS NOT NULL");
  } else {
    whereClauses.push("n.archived_at IS NULL");
    if (status === "unread") {
      whereClauses.push("n.read_at IS NULL");
    }
  }

  if (priority) {
    params.push(priority);
    whereClauses.push(`n.priority = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(
      `(n.title ILIKE $${idx} OR n.body ILIKE $${idx} OR n.category_slug ILIKE $${idx})`,
    );
  }

  if (cursor) {
    params.push(cursor);
    whereClauses.push(`n.triggered_at < $${params.length}`);
  }

  params.push(limit + 1);
  const limitIdx = params.length;

  const whereSql = whereClauses.join(" AND ");
  const isProd = process.env.NODE_ENV === "production";
  const unreadSql = isProd
    ? `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL AND (metadata->>'demo' IS NULL OR metadata->>'demo' != 'true')`
    : `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL`;

  let rows: Record<string, unknown>[];
  let unreadCount: number;
  try {
    const [{ rows: feedRows }, { rows: unreadRows }] = await Promise.all([
      query(
        `SELECT n.id, n.title, n.body, n.category_slug, n.priority, n.metadata,
           to_json(n.triggered_at) #>> '{}' AS triggered_at,
           to_json(n.read_at) #>> '{}' AS read_at,
           to_json(n.archived_at) #>> '{}' AS archived_at,
           to_json(n.expires_at) #>> '{}' AS expires_at,
           n.cta_label, n.cta_url,
           COALESCE((
             SELECT json_agg(
               json_build_object('id', nc.id, 'channel', nc.channel)
               ORDER BY nc.id ASC
             )
             FROM notification_channels nc
             WHERE nc.notification_id = n.id
           ), '[]'::json) AS channels
         FROM notifications n
         WHERE ${whereSql}
         ORDER BY n.triggered_at DESC
         LIMIT $${limitIdx}`,
        params,
      ),
      query(unreadSql, [user.id]),
    ]);
    rows = feedRows;
    unreadCount = parseInt(unreadRows[0].count, 10);
  } catch (error) {
    console.error("[mobile-api] notifications query failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to load notifications.",
      500,
    );
  }

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  const items: NotificationFeedItem[] = sliced.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    categorySlug: row.category_slug as string,
    categoryLabel: null,
    priority: row.priority as NotificationPriority,
    metadata: (row.metadata ?? {}) as Json,
    triggeredAt: row.triggered_at as string,
    readAt: row.read_at as string | null,
    archivedAt: row.archived_at as string | null,
    expiresAt: row.expires_at as string | null,
    ctaLabel: row.cta_label as string | null,
    ctaUrl: row.cta_url as string | null,
    channels: (row.channels ?? []) as NotificationFeedItem["channels"],
  }));

  const visibleItems = isProd
    ? items.filter((n) => !isDemoNotification(n.metadata))
    : items;

  const nextCursor = hasMore
    ? (sliced[sliced.length - 1]?.triggered_at as string | undefined) ?? null
    : null;

  return ok(
    visibleItems.map((n) => toNotification(n)),
    {
      hasMore,
      nextCursor,
      unreadCount,
    },
  );
});
