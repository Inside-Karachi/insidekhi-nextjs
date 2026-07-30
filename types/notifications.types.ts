import type { Database, Json, Tables, TablesInsert } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationChannel =
  Database["public"]["Enums"]["notification_channel_enum"];
export type NotificationPriority =
  Database["public"]["Enums"]["notification_priority_enum"];
export type NotificationDeliveryStatus =
  Database["public"]["Enums"]["notification_delivery_status_enum"];
export type NotificationUserRole = Database["public"]["Enums"]["user_role"];
export type NotificationFeedStatusFilter = "all" | "unread" | "archived";

export interface NotificationFeedFilters {
  status?: NotificationFeedStatusFilter;
  includeArchived?: boolean;
  search?: string;
  channel?: NotificationChannel | "all";
  priority?: NotificationPriority | "all";
}

export type NotificationRecord = Tables<"notifications">;
export type NotificationChannelRecord = Tables<"notification_channels">;
export type NotificationOutboxRecord = Tables<"notification_outbox">;
export type NotificationPreferenceRecord = Tables<"notification_preferences">;
export type NotificationCategoryRecord = Tables<"notification_categories">;

export type NotificationInsert = TablesInsert<"notifications">;
export type NotificationChannelInsert = TablesInsert<"notification_channels">;
export type NotificationOutboxInsert = TablesInsert<"notification_outbox">;

export type NotificationChannelConfig = {
  bell: boolean;
  email: boolean;
  push: boolean;
};

export type ChannelOverrides = Partial<
  Record<NotificationChannel, boolean | undefined>
>;

export type ChannelScheduleOverrides = Partial<
  Record<NotificationChannel, string | null | undefined>
>;

export interface CreateNotificationInput {
  recipientId: string;
  roleScope: NotificationUserRole;
  categorySlug: string;
  title: string;
  body: string;
  metadata?: Json;
  priority?: NotificationPriority;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  dedupeKey?: string | null;
  actorId?: string | null;
  expiresAt?: string | null;
  triggeredAt?: string | null;
  channelOverrides?: ChannelOverrides;
  scheduleOverrides?: ChannelScheduleOverrides;
  validateRecipientRole?: boolean;
}

export interface CreateNotificationOptions {
  supabase?: SupabaseClient<Database>;
}

export interface CreateNotificationResult {
  notification: NotificationRecord;
  channels: NotificationChannelRecord[];
  outbox: NotificationOutboxRecord[];
  deduped: boolean;
}

export interface EffectiveChannelConfig {
  category: NotificationCategoryRecord;
  config: NotificationChannelConfig;
  preferences: NotificationPreferenceRecord[];
}

export interface NotificationFeedChannel {
  id: number;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  sentAt: string | null;
  deliverAfter: string | null;
  lastAttemptedAt: string | null;
  error: Json | null;
}

export interface NotificationFeedItem {
  id: string;
  title: string;
  body: string;
  categorySlug: string;
  categoryLabel: string | null;
  priority: NotificationPriority;
  metadata: Json;
  triggeredAt: string;
  readAt: string | null;
  archivedAt: string | null;
  expiresAt: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  channels: NotificationFeedChannel[];
}

export interface ListNotificationsParams {
  profileId: string;
  limit?: number;
  cursor?: string | null;
  includeArchived?: boolean;
  status?: NotificationFeedStatusFilter;
  search?: string;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
}

export interface ListNotificationsResult {
  notifications: NotificationFeedItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface UnreadCountResult {
  unreadCount: number;
}

export interface MarkNotificationReadParams {
  notificationId: string;
  archive?: boolean;
}
