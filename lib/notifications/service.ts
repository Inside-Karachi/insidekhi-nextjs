import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  getDefaultChannelConfig,
  getEffectiveChannelConfig,
} from "@/lib/notifications/preferences";
import type { Database } from "@/types/supabase";
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
import type { SupabaseClient } from "@supabase/supabase-js";

const CHANNELS: NotificationChannel[] = ["bell", "email", "push"];
const ASYNC_CHANNELS = new Set<NotificationChannel>(["email", "push"]);
const FEED_PAGE_SIZE_DEFAULT = 20;

class NotificationServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NotificationServiceError";
  }
}

type SupabaseClientType = SupabaseClient<Database>;

type ListQueryRow = NotificationRecord & {
  notification_channels: NotificationChannelRecord[];
  category: {
    label: string;
  } | null;
};

const getNowIso = () => new Date().toISOString();

const getServiceClient = cache(async () =>
  createServerSupabase({ useServiceRole: true })
);

function escapeIlike(search: string): string {
  return search.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function resolveCategorySlugForRole(
  supabase: SupabaseClientType,
  role: NotificationUserRole,
  fallbackSlug?: string
): Promise<string> {
  const { data: targetedCategory, error: targetedError } = await supabase
    .from("notification_categories")
    .select("slug")
    .contains("audience_roles", [role])
    .order("is_mandatory", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (targetedError) {
    throw new NotificationServiceError(
      `Failed to resolve notification category for role ${role}: ${targetedError.message}`,
      targetedError
    );
  }

  if (targetedCategory?.slug) {
    return targetedCategory.slug;
  }

  if (fallbackSlug) {
    const { data: explicitFallback, error: explicitFallbackError } = await supabase
      .from("notification_categories")
      .select("slug")
      .eq("slug", fallbackSlug)
      .maybeSingle();

    if (explicitFallbackError) {
      throw new NotificationServiceError(
        `Failed to validate fallback notification category ${fallbackSlug}: ${explicitFallbackError.message}`,
        explicitFallbackError
      );
    }

    if (explicitFallback?.slug) {
      return explicitFallback.slug;
    }
  }

  const { data: fallbackCategory, error: fallbackError } = await supabase
    .from("notification_categories")
    .select("slug")
    .order("slug", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw new NotificationServiceError(
      `Failed to load fallback notification category: ${fallbackError.message}`,
      fallbackError
    );
  }

  if (!fallbackCategory?.slug) {
    throw new NotificationServiceError(
      "No notification categories available for fallback"
    );
  }

  return fallbackCategory.slug;
}

async function ensureServiceClient(
  provided?: SupabaseClientType
): Promise<SupabaseClientType> {
  if (provided) {
    return provided;
  }
  return getServiceClient();
}

async function loadRecipientRole(
  supabase: SupabaseClientType,
  recipientId: string
): Promise<Database["public"]["Enums"]["user_role"] | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", recipientId)
    .single();

  if (error) {
    throw new NotificationServiceError(
      `Failed to load recipient profile: ${error.message}`,
      error
    );
  }

  return data?.role ?? null;
}

async function findExistingNotification(
  supabase: SupabaseClientType,
  recipientId: string,
  dedupeKey: string
): Promise<CreateNotificationResult | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", recipientId)
    .eq("dedupe_key", dedupeKey)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new NotificationServiceError(
      `Failed to check existing notification: ${error.message}`,
      error
    );
  }

  if (!data) {
    return null;
  }

  const { data: channels, error: channelsError } = await supabase
    .from("notification_channels")
    .select("*")
    .eq("notification_id", data.id);

  if (channelsError) {
    throw new NotificationServiceError(
      `Failed to load notification channels for dedupe match: ${channelsError.message}`,
      channelsError
    );
  }

  let outbox: NotificationOutboxRecord[] = [];
  if (channels && channels.length) {
    const channelIds = channels.map((channel) => channel.id);
    const { data: outboxRows, error: outboxError } = await supabase
      .from("notification_outbox")
      .select("*")
      .in("notification_channel_id", channelIds);

    if (outboxError) {
      throw new NotificationServiceError(
        `Failed to load notification outbox entries: ${outboxError.message}`,
        outboxError
      );
    }

    outbox = outboxRows ?? [];
  }

  return {
    notification: data,
    channels: channels ?? [],
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

async function buildOutboxInserts(
  supabase: SupabaseClientType,
  channels: NotificationChannelRecord[],
  scheduleOverrides?: CreateNotificationInput["scheduleOverrides"]
): Promise<NotificationOutboxInsert[]> {
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
  options?: CreateNotificationOptions
): Promise<CreateNotificationResult> {
  const supabase = await ensureServiceClient(options?.supabase);

  if (input.validateRecipientRole) {
    const role = await loadRecipientRole(supabase, input.recipientId);
    if (role && role !== input.roleScope) {
      throw new NotificationServiceError(
        `Recipient role mismatch. Expected ${input.roleScope} but found ${role}.`
      );
    }
  }

  if (input.dedupeKey) {
    const existing = await findExistingNotification(
      supabase,
      input.recipientId,
      input.dedupeKey
    );
    if (existing) {
      return existing;
    }
  }

  let channelConfigResult: EffectiveChannelConfig | null = null;
  let effectiveCategorySlug = input.categorySlug;

  try {
    effectiveCategorySlug = await resolveCategorySlugForRole(
      supabase,
      input.roleScope,
      input.categorySlug
    );
  } catch (error) {
    throw new NotificationServiceError(
      `Unable to resolve notification category slug: ${(error as Error).message}`,
      error
    );
  }

  try {
    channelConfigResult = await getEffectiveChannelConfig(
      supabase,
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
  const { data: notification, error: insertError } = await supabase
    .from("notifications")
    .insert(notificationInsert)
    .select("*")
    .single();

  if (insertError || !notification) {
    throw new NotificationServiceError(
      `Failed to insert notification: ${insertError?.message ?? "unknown"}`,
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
    const { data: insertedChannels, error: channelError } = await supabase
      .from("notification_channels")
      .insert(channelInserts)
      .select("*");

    if (channelError) {
      await supabase.from("notifications").delete().eq("id", notification.id);

      throw new NotificationServiceError(
        `Failed to insert notification channels: ${channelError.message}`,
        channelError
      );
    }

    channelRows = insertedChannels ?? [];
  }

  const outboxInserts = await buildOutboxInserts(
    supabase,
    channelRows,
    input.scheduleOverrides
  );

  let outboxRows: NotificationOutboxRecord[] = [];
  if (outboxInserts.length) {
    const { data: insertedOutbox, error: outboxError } = await supabase
      .from("notification_outbox")
      .insert(outboxInserts)
      .select("*");

    if (outboxError) {
      throw new NotificationServiceError(
        `Failed to insert notification outbox entries: ${outboxError.message}`,
        outboxError
      );
    }

    outboxRows = insertedOutbox ?? [];
  }

  return {
    notification,
    channels: channelRows,
    outbox: outboxRows,
    deduped: false,
  };
}

export async function listNotifications(
  supabase: SupabaseClientType,
  params: ListNotificationsParams
): Promise<ListNotificationsResult> {
  const limit = Math.min(params.limit ?? FEED_PAGE_SIZE_DEFAULT, 100);
  const status: NotificationFeedStatusFilter = params.status ?? "all";
  const includeArchived = params.includeArchived ?? false;

  let query = supabase
    .from("notifications")
    .select(
      `id, title, body, category_slug, priority, metadata, triggered_at, read_at, archived_at, expires_at, cta_label, cta_url,
       actor_id, recipient_id, dedupe_key, created_at, updated_at, role_scope,
       notification_channels(id, channel, status, sent_at, deliver_after, last_attempted_at, error, attempt_count, created_at, notification_id, provider_message_id, updated_at),
       category:notification_categories(label)`
    )
    .eq("recipient_id", params.profileId)
    .order("triggered_at", { ascending: false })
    .limit(limit + 1);

  if (status === "archived") {
    query = query.not("archived_at", "is", null);
  } else {
    if (!includeArchived) {
      query = query.is("archived_at", null);
    }

    if (status === "unread") {
      query = query.is("read_at", null);
    }
  }

  if (params.priority) {
    query = query.eq("priority", params.priority);
  }

  if (params.channel) {
    query = query.filter("notification_channels.channel", "eq", params.channel);
  }

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    const escaped = escapeIlike(trimmedSearch);
    query = query.or(
      [
        `title.ilike.%${escaped}%`,
        `body.ilike.%${escaped}%`,
        `category_slug.ilike.%${escaped}%`,
      ].join(",")
    );
  }

  if (params.cursor) {
    query = query.lt("triggered_at", params.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw new NotificationServiceError(
      `Failed to fetch notifications: ${error.message}`,
      error
    );
  }

  const rows = (data ?? []) as unknown as ListQueryRow[];
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  const notifications = sliced.map(mapRowToFeedItem);
  const nextCursor = hasMore
    ? sliced[sliced.length - 1]?.triggered_at ?? null
    : null;

  return {
    notifications,
    hasMore,
    nextCursor,
  };
}

export async function getUnreadCount(
  supabase: SupabaseClientType,
  profileId: string,
  options?: { excludeDemo?: boolean }
): Promise<UnreadCountResult> {
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profileId)
    .is("read_at", null)
    .is("archived_at", null);

  if (options?.excludeDemo) {
    query = query.or("metadata->>demo.is.null,metadata->>demo.neq.true");
  }

  const { count, error } = await query;

  if (error) {
    throw new NotificationServiceError(
      `Failed to fetch unread count: ${error.message}`,
      error
    );
  }

  return {
    unreadCount: count ?? 0,
  };
}

export async function markNotificationRead(
  supabase: SupabaseClientType,
  params: MarkNotificationReadParams
): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: params.notificationId,
    p_archive: params.archive ?? false,
  });

  if (error) {
    throw new NotificationServiceError(
      `Failed to mark notification read: ${error.message}`,
      error
    );
  }
}

export async function markAllNotificationsRead(
  supabase: SupabaseClientType,
  profileId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("mark_all_notifications_read", {
    p_profile_id: profileId,
  });

  if (error) {
    throw new NotificationServiceError(
      `Failed to mark notifications read: ${error.message}`,
      error
    );
  }

  return data ?? 0;
}

export function getChannelFallbackConfig(): NotificationChannelConfig {
  return getDefaultChannelConfig();
}
