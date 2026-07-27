import { query } from "@/lib/db";
import {
  getDefaultChannelConfig,
  getEffectiveChannelConfig,
} from "@/lib/notifications/preferences";
import type {
  CreateNotificationInput,
  CreateNotificationOptions,
  CreateNotificationResult,
  EffectiveChannelConfig,
  ListNotificationsParams,
  ListNotificationsResult,
  MarkNotificationReadParams,
  NotificationChannel,
  NotificationChannelConfig,
  NotificationChannelInsert,
  NotificationChannelRecord,
  NotificationFeedStatusFilter,
  NotificationFeedChannel,
  NotificationFeedItem,
  NotificationInsert,
  NotificationOutboxInsert,
  NotificationOutboxRecord,
  NotificationPriority,
  NotificationRecord,
  NotificationUserRole,
  UnreadCountResult,
} from "@/types/notifications.types";

const CHANNELS: NotificationChannel[] = ["bell", "email", "push"];
const ASYNC_CHANNELS = new Set<NotificationChannel>(["email", "push"]);
const FEED_PAGE_SIZE_DEFAULT = 20;

class NotificationServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NotificationServiceError";
  }
}

type ListQueryRow = NotificationRecord & {
  notification_channels: NotificationChannelRecord[];
  category: {
    label: string;
  } | null;
};

const getNowIso = () => new Date().toISOString();

export async function resolveCategorySlugForRole(
  role: NotificationUserRole,
  fallbackSlug?: string
): Promise<string> {
  const { rows: targetedRows } = await query(
    `SELECT slug FROM public.notification_categories
     WHERE audience_roles @> ARRAY[$1]::text[]
     ORDER BY is_mandatory DESC
     LIMIT 1`,
    [role]
  );

  if (targetedRows[0]?.slug) {
    return targetedRows[0].slug;
  }

  if (fallbackSlug) {
    const { rows: fallbackRows } = await query(
      `SELECT slug FROM public.notification_categories WHERE slug = $1 LIMIT 1`,
      [fallbackSlug]
    );

    if (fallbackRows[0]?.slug) {
      return fallbackRows[0].slug;
    }
  }

  const { rows: defaultRows } = await query(
    `SELECT slug FROM public.notification_categories ORDER BY slug ASC LIMIT 1`
  );

  if (!defaultRows[0]?.slug) {
    throw new NotificationServiceError(
      "No notification categories available for fallback"
    );
  }

  return defaultRows[0].slug;
}

async function loadRecipientRole(recipientId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
    [recipientId]
  );

  return rows[0]?.role ?? null;
}

async function findExistingNotification(
  recipientId: string,
  dedupeKey: string
): Promise<CreateNotificationResult | null> {
  const { rows: notificationRows } = await query(
    `SELECT * FROM public.notifications
     WHERE recipient_id = $1 AND dedupe_key = $2
     LIMIT 1`,
    [recipientId, dedupeKey]
  );
  const data = notificationRows[0];

  if (!data) {
    return null;
  }

  const { rows: channels } = await query(
    `SELECT * FROM public.notification_channels WHERE notification_id = $1`,
    [data.id]
  );

  let outbox: NotificationOutboxRecord[] = [];
  if (channels.length) {
    const channelIds = channels.map((channel) => channel.id);
    const { rows: outboxRows } = await query(
      `SELECT * FROM public.notification_outbox
       WHERE notification_channel_id = ANY($1::bigint[])`,
      [channelIds]
    );

    outbox = outboxRows as NotificationOutboxRecord[];
  }

  return {
    notification: data,
    channels: channels as NotificationChannelRecord[],
    outbox,
    deduped: true,
  };
}

function buildNotificationInsert(
  input: CreateNotificationInput
): NotificationInsert {
  return {
    recipient_id: input.recipientId,
    role_scope: input.roleScope,
    category_slug: input.categorySlug,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
    priority: input.priority ?? ("normal" satisfies NotificationPriority),
    cta_label: input.ctaLabel ?? null,
    cta_url: input.ctaUrl ?? null,
    dedupe_key: input.dedupeKey ?? null,
    actor_id: input.actorId ?? null,
    expires_at: input.expiresAt ?? null,
    triggered_at: input.triggeredAt ?? getNowIso(),
  };
}

function buildChannelInserts(
  notificationId: string,
  config: NotificationChannelConfig,
  scheduleOverrides?: CreateNotificationInput["scheduleOverrides"]
): {
  records: NotificationChannelInsert[];
  asyncChannels: NotificationChannelInsert[];
} {
  const records: NotificationChannelInsert[] = [];
  const asyncChannels: NotificationChannelInsert[] = [];
  const nowIso = getNowIso();

  CHANNELS.forEach((channel) => {
    const enabled = config[channel];
    if (!enabled) return;

    const base: NotificationChannelInsert = {
      notification_id: notificationId,
      channel,
      status: ASYNC_CHANNELS.has(channel) ? "pending" : "sent",
      sent_at: ASYNC_CHANNELS.has(channel) ? null : nowIso,
      deliver_after: scheduleOverrides?.[channel] ?? null,
    } satisfies NotificationChannelInsert;

    records.push(base);

    if (ASYNC_CHANNELS.has(channel)) {
      asyncChannels.push(base);
    }
  });

  return { records, asyncChannels };
}

function buildOutboxInserts(
  channels: NotificationChannelRecord[],
  scheduleOverrides?: CreateNotificationInput["scheduleOverrides"]
): NotificationOutboxInsert[] {
  if (!channels.length) {
    return [];
  }

  const nowIso = getNowIso();
  return channels
    .filter((channel) => ASYNC_CHANNELS.has(channel.channel))
    .map(
      (channel) =>
        ({
          notification_channel_id: channel.id,
          status: "pending",
          scheduled_for:
            scheduleOverrides?.[channel.channel] ??
            channel.deliver_after ??
            nowIso,
        } satisfies NotificationOutboxInsert)
    );
}

function mapChannelToFeed(
  channel: NotificationChannelRecord
): NotificationFeedChannel {
  return {
    id: channel.id,
    channel: channel.channel,
    status: channel.status,
    sentAt: channel.sent_at,
    deliverAfter: channel.deliver_after ?? null,
    lastAttemptedAt: channel.last_attempted_at ?? null,
    error: channel.error ?? null,
  };
}

function mapRowToFeedItem(row: ListQueryRow): NotificationFeedItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    categorySlug: row.category_slug,
    categoryLabel: row.category?.label ?? null,
    priority: row.priority,
    metadata: row.metadata ?? {},
    triggeredAt: row.triggered_at,
    readAt: row.read_at ?? null,
    archivedAt: row.archived_at ?? null,
    expiresAt: row.expires_at ?? null,
    ctaLabel: row.cta_label ?? null,
    ctaUrl: row.cta_url ?? null,
    channels: (row.notification_channels ?? []).map(mapChannelToFeed),
  };
}

export async function createNotification(
  input: CreateNotificationInput,
  _options?: CreateNotificationOptions
): Promise<CreateNotificationResult> {
  if (input.validateRecipientRole) {
    const role = await loadRecipientRole(input.recipientId);
    if (role && role !== input.roleScope) {
      throw new NotificationServiceError(
        `Recipient role mismatch. Expected ${input.roleScope} but found ${role}.`
      );
    }
  }

  if (input.dedupeKey) {
    const existing = await findExistingNotification(
      input.recipientId,
      input.dedupeKey
    );
    if (existing) {
      return existing;
    }
  }

  let effectiveCategorySlug = input.categorySlug;

  try {
    effectiveCategorySlug = await resolveCategorySlugForRole(
      input.roleScope,
      input.categorySlug
    );
  } catch (error) {
    throw new NotificationServiceError(
      `Unable to resolve notification category slug: ${(error as Error).message}`,
      error
    );
  }

  let channelConfigResult: EffectiveChannelConfig;
  try {
    channelConfigResult = await getEffectiveChannelConfig(
      input.recipientId,
      effectiveCategorySlug,
      input.channelOverrides
    );
  } catch (error) {
    throw new NotificationServiceError(
      `Unable to determine channel configuration: ${(error as Error).message}`,
      error
    );
  }

  const notificationInsert = buildNotificationInsert({
    ...input,
    categorySlug: effectiveCategorySlug,
  });

  let notification: NotificationRecord;
  try {
    const { rows } = await query(
      `INSERT INTO public.notifications
         (recipient_id, role_scope, category_slug, title, body, metadata, priority,
          cta_label, cta_url, dedupe_key, actor_id, expires_at, triggered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        notificationInsert.recipient_id,
        notificationInsert.role_scope,
        notificationInsert.category_slug,
        notificationInsert.title,
        notificationInsert.body,
        notificationInsert.metadata,
        notificationInsert.priority,
        notificationInsert.cta_label,
        notificationInsert.cta_url,
        notificationInsert.dedupe_key,
        notificationInsert.actor_id,
        notificationInsert.expires_at,
        notificationInsert.triggered_at,
      ]
    );
    notification = rows[0] as NotificationRecord;
  } catch (insertError) {
    throw new NotificationServiceError(
      `Failed to insert notification: ${(insertError as Error).message}`,
      insertError
    );
  }

  const { records: channelInserts } = buildChannelInserts(
    notification.id,
    channelConfigResult.config,
    input.scheduleOverrides
  );

  let channelRows: NotificationChannelRecord[] = [];
  if (channelInserts.length) {
    try {
      const values: unknown[] = [];
      const placeholders = channelInserts
        .map((c, i) => {
          const base = i * 5;
          values.push(
            c.notification_id,
            c.channel,
            c.status,
            c.sent_at,
            c.deliver_after
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        })
        .join(", ");

      const { rows } = await query(
        `INSERT INTO public.notification_channels
           (notification_id, channel, status, sent_at, deliver_after)
         VALUES ${placeholders}
         RETURNING *`,
        values
      );
      channelRows = rows as NotificationChannelRecord[];
    } catch (channelError) {
      await query(`DELETE FROM public.notifications WHERE id = $1`, [
        notification.id,
      ]);

      throw new NotificationServiceError(
        `Failed to insert notification channels: ${(channelError as Error).message}`,
        channelError
      );
    }
  }

  const outboxInserts = buildOutboxInserts(
    channelRows,
    input.scheduleOverrides
  );

  let outboxRows: NotificationOutboxRecord[] = [];
  if (outboxInserts.length) {
    try {
      const values: unknown[] = [];
      const placeholders = outboxInserts
        .map((o, i) => {
          const base = i * 3;
          values.push(o.notification_channel_id, o.status, o.scheduled_for);
          return `($${base + 1}, $${base + 2}, $${base + 3})`;
        })
        .join(", ");

      const { rows } = await query(
        `INSERT INTO public.notification_outbox
           (notification_channel_id, status, scheduled_for)
         VALUES ${placeholders}
         RETURNING *`,
        values
      );
      outboxRows = rows as NotificationOutboxRecord[];
    } catch (outboxError) {
      throw new NotificationServiceError(
        `Failed to insert notification outbox entries: ${(outboxError as Error).message}`,
        outboxError
      );
    }
  }

  return {
    notification,
    channels: channelRows,
    outbox: outboxRows,
    deduped: false,
  };
}

export async function listNotifications(
  params: ListNotificationsParams
): Promise<ListNotificationsResult> {
  const limit = Math.min(params.limit ?? FEED_PAGE_SIZE_DEFAULT, 100);
  const status: NotificationFeedStatusFilter = params.status ?? "all";
  const includeArchived = params.includeArchived ?? false;

  const conditions: string[] = ["n.recipient_id = $1"];
  const values: unknown[] = [params.profileId];
  let idx = 2;

  if (status === "archived") {
    conditions.push("n.archived_at IS NOT NULL");
  } else {
    if (!includeArchived) {
      conditions.push("n.archived_at IS NULL");
    }
    if (status === "unread") {
      conditions.push("n.read_at IS NULL");
    }
  }

  if (params.priority) {
    conditions.push(`n.priority = $${idx}`);
    values.push(params.priority);
    idx++;
  }

  if (params.channel) {
    conditions.push(
      `EXISTS (SELECT 1 FROM public.notification_channels nc WHERE nc.notification_id = n.id AND nc.channel = $${idx})`
    );
    values.push(params.channel);
    idx++;
  }

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    conditions.push(
      `(n.title ILIKE $${idx} OR n.body ILIKE $${idx} OR n.category_slug ILIKE $${idx})`
    );
    values.push(`%${trimmedSearch}%`);
    idx++;
  }

  if (params.cursor) {
    conditions.push(`n.triggered_at < $${idx}`);
    values.push(params.cursor);
    idx++;
  }

  values.push(limit + 1);

  const { rows } = await query(
    `SELECT
       n.id, n.title, n.body, n.category_slug, n.priority, n.metadata, n.triggered_at,
       n.read_at, n.archived_at, n.expires_at, n.cta_label, n.cta_url,
       n.actor_id, n.recipient_id, n.dedupe_key, n.created_at, n.updated_at, n.role_scope,
       COALESCE(
         (SELECT json_agg(nc.* ORDER BY nc.created_at)
          FROM public.notification_channels nc WHERE nc.notification_id = n.id),
         '[]'
       ) AS notification_channels,
       CASE WHEN cat.slug IS NOT NULL THEN json_build_object('label', cat.label) ELSE NULL END AS category
     FROM public.notifications n
     LEFT JOIN public.notification_categories cat ON cat.slug = n.category_slug
     WHERE ${conditions.join(" AND ")}
     ORDER BY n.triggered_at DESC
     LIMIT $${idx}`,
    values
  );

  const typedRows = rows as unknown as ListQueryRow[];
  const hasMore = typedRows.length > limit;
  const sliced = hasMore ? typedRows.slice(0, limit) : typedRows;

  const notifications = sliced.map(mapRowToFeedItem);
  const nextCursor = hasMore
    ? (sliced[sliced.length - 1]?.triggered_at ?? null)
    : null;

  return {
    notifications,
    hasMore,
    nextCursor,
  };
}

export async function getUnreadCount(
  profileId: string,
  options?: { excludeDemo?: boolean }
): Promise<UnreadCountResult> {
  const conditions = [
    "recipient_id = $1",
    "read_at IS NULL",
    "archived_at IS NULL",
  ];

  if (options?.excludeDemo) {
    conditions.push(
      "(metadata->>'demo' IS NULL OR metadata->>'demo' != 'true')"
    );
  }

  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM public.notifications WHERE ${conditions.join(" AND ")}`,
    [profileId]
  );

  return {
    unreadCount: rows[0]?.count ?? 0,
  };
}

export async function markNotificationRead(
  params: MarkNotificationReadParams,
  recipientId: string
): Promise<void> {
  const { rows } = await query(
    `UPDATE public.notifications
     SET read_at = COALESCE(read_at, timezone('utc', now())),
         archived_at = CASE WHEN $1 THEN COALESCE(archived_at, timezone('utc', now())) ELSE archived_at END,
         updated_at = timezone('utc', now())
     WHERE id = $2 AND recipient_id = $3
     RETURNING id`,
    [params.archive ?? false, params.notificationId, recipientId]
  );

  if (rows.length === 0) {
    throw new NotificationServiceError(
      `Failed to mark notification read: notification not found or not owned by this user`
    );
  }
}

export async function markAllNotificationsRead(
  profileId: string
): Promise<number> {
  const { rows } = await query(
    `UPDATE public.notifications
     SET read_at = COALESCE(read_at, timezone('utc', now())),
         updated_at = timezone('utc', now())
     WHERE recipient_id = $1 AND read_at IS NULL
     RETURNING id`,
    [profileId]
  );

  return rows.length;
}

export function getChannelFallbackConfig(): NotificationChannelConfig {
  return getDefaultChannelConfig();
}
