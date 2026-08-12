import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type {
  NotificationChannel,
  NotificationFeedStatusFilter,
  NotificationPriority,
} from "@/types/notifications.types";

const FEED_PAGE_SIZE_DEFAULT = 20;

function parseBooleanParam(value: string | null, fallback = false): boolean {
  if (value === null) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function parseLimitParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return undefined;
  }
  return Math.min(parsed, 100);
}

const STATUS_OPTIONS: NotificationFeedStatusFilter[] = [
  "all",
  "unread",
  "archived",
];

const CHANNEL_OPTIONS: NotificationChannel[] = ["bell", "email", "push"];

const PRIORITY_OPTIONS: NotificationPriority[] = ["low", "normal", "high"];

function parseStatusParam(
  value: string | null
): NotificationFeedStatusFilter | undefined {
  if (!value) return undefined;
  return STATUS_OPTIONS.includes(value as NotificationFeedStatusFilter)
    ? (value as NotificationFeedStatusFilter)
    : undefined;
}

function parseChannelParam(
  value: string | null
): NotificationChannel | undefined {
  if (!value) return undefined;
  return CHANNEL_OPTIONS.includes(value as NotificationChannel)
    ? (value as NotificationChannel)
    : undefined;
}

function parsePriorityParam(
  value: string | null
): NotificationPriority | undefined {
  if (!value) return undefined;
  return PRIORITY_OPTIONS.includes(value as NotificationPriority)
    ? (value as NotificationPriority)
    : undefined;
}

function escapeIlike(search: string): string {
  return search.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseLimitParam(searchParams.get("limit")) ?? FEED_PAGE_SIZE_DEFAULT;
    const includeArchived = parseBooleanParam(
      searchParams.get("includeArchived")
    );
    const status = parseStatusParam(searchParams.get("status")) ?? "all";
    const channel = parseChannelParam(searchParams.get("channel"));
    const priority = parsePriorityParam(searchParams.get("priority"));
    const rawSearch = searchParams.get("search");
    const search =
      rawSearch && rawSearch.trim().length ? rawSearch.trim() : undefined;

    // Always scope to the caller's own notifications - never trust a
    // request-supplied recipient id.
    const whereClauses: string[] = ["n.recipient_id = $1"];
    const params: unknown[] = [session.userId];

    if (status === "archived") {
      whereClauses.push("n.archived_at IS NOT NULL");
    } else {
      if (!includeArchived) {
        whereClauses.push("n.archived_at IS NULL");
      }
      if (status === "unread") {
        whereClauses.push("n.read_at IS NULL");
      }
    }

    if (priority) {
      params.push(priority);
      whereClauses.push(`n.priority = $${params.length}`);
    }

    if (search) {
      params.push(`%${escapeIlike(search)}%`);
      const idx = params.length;
      whereClauses.push(
        `(n.title ILIKE $${idx} OR n.body ILIKE $${idx} OR n.category_slug ILIKE $${idx})`
      );
    }

    if (cursor) {
      params.push(cursor);
      whereClauses.push(`n.triggered_at < $${params.length}`);
    }

    // The old Supabase embed-filter on notification_channels.channel narrows
    // which channel rows show up per notification without excluding the
    // parent notification itself - a correlated subquery reproduces that.
    params.push(channel ?? null);
    const channelParamIdx = params.length;

    params.push(limit + 1);
    const limitIdx = params.length;

    const whereSql = whereClauses.join(" AND ");

    const excludeDemo = process.env.NODE_ENV === "production";
    const unreadSql = excludeDemo
      ? `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL AND (metadata->>'demo' IS NULL OR metadata->>'demo' != 'true')`
      : `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL`;

    // The feed query and the unread count are independent reads - run them
    // concurrently instead of round-tripping to the pool one at a time.
    const [{ rows }, { rows: unreadRows }] = await Promise.all([
      query(
        `SELECT n.id, n.title, n.body, n.category_slug, n.priority, n.metadata,
           to_json(n.triggered_at) #>> '{}' AS triggered_at,
           to_json(n.read_at) #>> '{}' AS read_at,
           to_json(n.archived_at) #>> '{}' AS archived_at,
           to_json(n.expires_at) #>> '{}' AS expires_at,
           n.cta_label, n.cta_url,
           cat.label AS category_label,
           COALESCE((
             SELECT json_agg(
               json_build_object(
                 'id', nc.id,
                 'channel', nc.channel,
                 'status', nc.status,
                 'sentAt', to_json(nc.sent_at) #>> '{}',
                 'deliverAfter', to_json(nc.deliver_after) #>> '{}',
                 'lastAttemptedAt', to_json(nc.last_attempted_at) #>> '{}',
                 'error', nc.error
               ) ORDER BY nc.id ASC
             )
             FROM notification_channels nc
             WHERE nc.notification_id = n.id
               AND ($${channelParamIdx}::text IS NULL OR nc.channel::text = $${channelParamIdx}::text)
           ), '[]'::json) AS channels
         FROM notifications n
         LEFT JOIN notification_categories cat ON cat.slug = n.category_slug
         WHERE ${whereSql}
         ORDER BY n.triggered_at DESC
         LIMIT $${limitIdx}`,
        params
      ),
      query(unreadSql, [session.userId]),
    ]);
    const unreadCount = parseInt(unreadRows[0].count, 10);

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;

    const notifications = sliced.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      categorySlug: row.category_slug,
      categoryLabel: row.category_label ?? null,
      priority: row.priority,
      metadata: row.metadata ?? {},
      triggeredAt: row.triggered_at,
      readAt: row.read_at,
      archivedAt: row.archived_at,
      expiresAt: row.expires_at,
      ctaLabel: row.cta_label,
      ctaUrl: row.cta_url,
      channels: row.channels ?? [],
    }));

    // In production, hide any demo/sample notifications (metadata.demo === true)
    const filteredNotifications =
      process.env.NODE_ENV === "production"
        ? notifications.filter((n) => {
            const meta = n.metadata as unknown as { demo?: unknown } | null;
            return !(meta && typeof meta === "object" && meta.demo === true);
          })
        : notifications;

    const nextCursor = hasMore
      ? (sliced[sliced.length - 1]?.triggered_at as string | undefined) ?? null
      : null;

    return NextResponse.json({
      notifications: filteredNotifications,
      meta: {
        hasMore,
        nextCursor,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("GET /api/notifications failed", error);
    // Outside production, surface the real cause in the response body -
    // the client only ever logs the status code, so without this a 500
    // here is a dead end unless someone happens to be watching the
    // `next dev` terminal at the exact moment it happens.
    const detail =
      process.env.NODE_ENV !== "production"
        ? error instanceof Error
          ? error.message
          : String(error)
        : undefined;
    return NextResponse.json(
      { error: "Failed to load notifications", ...(detail ? { detail } : {}) },
      { status: 500 }
    );
  }
}
