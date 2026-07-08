import { randomUUID } from "crypto";

import { logNotificationFailed, logNotificationSent } from "@/lib/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";
import type {
  NotificationChannelRecord,
  NotificationOutboxRecord,
  NotificationRecord,
} from "@/types/notifications.types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { NotificationEmailError, sendNotificationEmail } from "./email";
import { generateBookingConfirmationEmail } from "@/lib/emails/booking-confirmation-template";

const MAX_BATCH_SIZE = 25;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 5;
const BACKOFF_SCHEDULE_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

class NotificationDispatchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NotificationDispatchError";
  }
}

type ServiceSupabaseClient = SupabaseClient<Database>;

type RecipientProfile = {
  id: string;
  full_name: string | null;
} | null;

type EmailChannelRecord = NotificationChannelRecord & {
  notification:
    | (NotificationRecord & {
        recipient_profile: RecipientProfile;
      })
    | null;
};

type EmailOutboxRow = NotificationOutboxRecord & {
  notification_channel: EmailChannelRecord | null;
};

interface RecipientInfo {
  email: string | null;
  fullName: string | null;
}

interface DispatchOptions {
  supabase?: ServiceSupabaseClient;
  limit?: number;
}

export interface DispatchSummary {
  attempted: number;
  sent: number;
  deferred: number;
  failed: number;
  skipped: number;
  recoveredLocks: number;
  errors: Array<{ outboxId: number; message: string }>;
}

function clampLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit < 1) {
    return MAX_BATCH_SIZE;
  }
  return Math.min(Math.floor(limit), MAX_BATCH_SIZE);
}

function extractStatusCode(message: string): number | null {
  const match = message.match(/status\s+(\d{3})/i);
  if (!match) {
    return null;
  }
  const code = Number(match[1]);
  return Number.isNaN(code) ? null : code;
}

function safeJson(value: unknown): Json {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (value ?? null) as Json;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    } satisfies Json;
  }

  if (Array.isArray(value)) {
    return value.map((item) => safeJson(item)) as Json;
  }

  if (typeof value === "object") {
    const entries: Record<string, Json> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      entries[key] = safeJson(val);
    }
    return entries as Json;
  }

  return String(value ?? "") as Json;
}

function serializeErrorDetails(error: unknown): Json {
  if (error instanceof NotificationEmailError) {
    return {
      name: error.name,
      message: error.message,
      cause: safeJson(error.cause),
    } satisfies Json;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    } satisfies Json;
  }

  return safeJson(error);
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof NotificationEmailError) {
    const message = error.message.toLowerCase();
    if (message.includes("not configured")) {
      return false;
    }
    if (message.includes("recipient email is required")) {
      return false;
    }

    const status = extractStatusCode(error.message);
    if (status !== null) {
      if (status === 429) {
        return true;
      }
      if (status >= 500) {
        return true;
      }
      if (status >= 400) {
        return false;
      }
    }
    return true;
  }

  return true;
}

function getBackoffDelayMs(retryCount: number): number {
  const index = Math.min(
    Math.max(retryCount - 1, 0),
    BACKOFF_SCHEDULE_MS.length - 1,
  );
  return (
    BACKOFF_SCHEDULE_MS[index] ??
    BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]
  );
}

async function releaseStaleLocks(
  supabase: ServiceSupabaseClient,
  thresholdIso: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("notification_outbox")
      .update({
        status: "pending",
        locked_at: null,
        locked_by: null,
      })
      .eq("status", "processing")
      .lt("locked_at", thresholdIso)
      .select("id");

    if (error) {
      console.error("[notifications] Failed to release stale locks", error);
      return 0;
    }

    return data?.length ?? 0;
  } catch (error) {
    console.error("[notifications] Unexpected error releasing locks", error);
    return 0;
  }
}

async function fetchEmailOutboxRows(
  supabase: ServiceSupabaseClient,
  limit: number,
  now: Date,
): Promise<EmailOutboxRow[]> {
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from("notification_outbox")
    .select(
      `
        id,
        notification_channel_id,
        retry_count,
        scheduled_for,
        status,
        next_attempt_at,
        locked_at,
        locked_by,
        last_error,
        created_at,
        updated_at,
        notification_channel:notification_channels!inner(
          id,
          notification_id,
          channel,
          status,
          attempt_count,
          last_attempted_at,
          sent_at,
          provider_message_id,
          deliver_after,
          error,
          created_at,
          updated_at,
          notification:notifications!inner(
            id,
            recipient_id,
            role_scope,
            category_slug,
            title,
            body,
            metadata,
            priority,
            triggered_at,
            cta_label,
            cta_url,
            recipient_profile:profiles!notifications_recipient_id_fkey(
              id,
              full_name
            )
          )
        )
      `,
    )
    .eq("status", "pending")
    .is("locked_at", null)
    .lte("scheduled_for", nowIso)
    .eq("notification_channel.channel", "email")
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new NotificationDispatchError(
      `Failed to load email outbox rows: ${error.message}`,
      error,
    );
  }

  const rows = (data ?? []) as unknown as EmailOutboxRow[];
  const nowTs = now.getTime();

  return rows.filter((row) => {
    if (!row.notification_channel || !row.notification_channel.notification) {
      return false;
    }
    if (!row.next_attempt_at) {
      return true;
    }
    const nextAttemptTs = Date.parse(row.next_attempt_at);
    return Number.isNaN(nextAttemptTs) ? true : nextAttemptTs <= nowTs;
  });
}

async function attemptLockOutboxRow(
  supabase: ServiceSupabaseClient,
  outboxId: number,
  lockToken: string,
): Promise<boolean> {
  const lockedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("notification_outbox")
    .update({
      status: "processing",
      locked_at: lockedAt,
      locked_by: lockToken,
    })
    .eq("id", outboxId)
    .eq("status", "pending")
    .is("locked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[notifications] Failed to lock outbox row ${outboxId}: ${error.message}`,
      error,
    );
    return false;
  }

  return Boolean(data);
}

async function markChannelSuccess(
  supabase: ServiceSupabaseClient,
  channel: NotificationChannelRecord,
  attemptIso: string,
  providerMessageId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("notification_channels")
    .update({
      status: "sent",
      sent_at: attemptIso,
      last_attempted_at: attemptIso,
      attempt_count: (channel.attempt_count ?? 0) + 1,
      provider_message_id: providerMessageId,
      error: null,
    })
    .eq("id", channel.id);

  if (error) {
    throw new NotificationDispatchError(
      `Failed to update channel ${channel.id}: ${error.message}`,
      error,
    );
  }
}

async function markOutboxSuccess(
  supabase: ServiceSupabaseClient,
  outboxId: number,
  lockToken: string,
  attemptIso: string,
): Promise<void> {
  const { error } = await supabase
    .from("notification_outbox")
    .update({
      status: "sent",
      locked_at: null,
      locked_by: null,
      next_attempt_at: null,
      last_error: null,
      updated_at: attemptIso,
    })
    .eq("id", outboxId)
    .eq("locked_by", lockToken);

  if (error) {
    throw new NotificationDispatchError(
      `Failed to finalize outbox ${outboxId}: ${error.message}`,
      error,
    );
  }
}

async function safeLogSent(
  notificationId: string,
  outboxId: number,
  providerMessageId: string | null,
) {
  try {
    await logNotificationSent(notificationId, "email", {
      outboxId,
      providerMessageId: providerMessageId ?? undefined,
    });
  } catch (error) {
    console.error(
      `[notifications] Failed to log notification_sent for ${notificationId}`,
      error,
    );
  }
}

async function safeLogFailure(
  notificationId: string,
  channelId: number,
  outcome: "failed" | "deferred",
  retries: number,
  outboxId: number,
  error: unknown,
  nextAttemptAt?: string | null,
) {
  try {
    await logNotificationFailed(notificationId, "email", error, {
      outcome,
      retries,
      outboxId,
      channelId,
      nextAttemptAt: nextAttemptAt ?? null,
    });
  } catch (logError) {
    console.error(
      `[notifications] Failed to log notification_failed for ${notificationId}`,
      logError,
    );
  }
}

async function getRecipientInfo(
  supabase: ServiceSupabaseClient,
  notification: NotificationRecord & { recipient_profile: RecipientProfile },
  cache: Map<string, RecipientInfo>,
): Promise<RecipientInfo> {
  const key = notification.recipient_id;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const info: RecipientInfo = {
    email: null,
    fullName: notification.recipient_profile?.full_name ?? null,
  };

  try {
    const { data, error } = await supabase.auth.admin.getUserById(key);
    if (!error && data?.user?.email) {
      info.email = data.user.email;
    } else if (error) {
      console.error(
        `[notifications] Failed to load auth user for ${key}: ${error.message}`,
        error,
      );
    }
  } catch (error) {
    console.error(
      `[notifications] Unexpected error loading auth user for ${key}`,
      error,
    );
  }

  cache.set(key, info);
  return info;
}

/**
 * Builds custom HTML for specific notification categories
 * Returns null if default template should be used
 */
async function buildCustomEmailHtml(
  supabase: ServiceSupabaseClient,
  notification: NotificationRecord,
): Promise<string | null> {
  // Use booking confirmation template
  if (notification.category_slug === "public_booking_confirmation") {
    try {
      console.log(
        "[dispatcher] Building custom email for category:",
        notification.category_slug,
      );

      const metadata = notification.metadata as Record<string, unknown> | null;
      const bookingId = metadata?.booking_id as number | undefined;

      console.log("[dispatcher] Booking ID from metadata:", bookingId);

      if (!bookingId) {
        console.warn("[dispatcher] No booking_id in notification metadata");
        return null;
      }

      // Fetch booking details with event and venue
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          booking_reference,
          customer_name,
          total_amount,
          event_id,
          events!inner (
            name,
            start_time,
            location_name,
            address
          )
        `,
        )
        .eq("id", bookingId)
        .single();

      console.log("[dispatcher] Booking query result:", {
        hasData: !!booking,
        hasError: !!bookingError,
        error: bookingError,
      });

      if (bookingError || !booking) {
        console.error("[dispatcher] Failed to fetch booking:", bookingError);
        return null;
      }

      // Extract event data (Supabase returns it as an array or object depending on query)
      type EventWithLocation = {
        name: string;
        start_time: string;
        location_name: string | null;
        address: string | null;
      };

      type BookingWithEvents = typeof booking & {
        events: EventWithLocation | EventWithLocation[];
      };

      const bookingData = booking as BookingWithEvents;
      const eventData = Array.isArray(bookingData.events)
        ? bookingData.events[0]
        : bookingData.events;

      if (!eventData) {
        console.error("[dispatcher] No event data in booking");
        return null;
      }

      console.log("[dispatcher] Event data found:", {
        name: eventData.name,
        hasLocation: !!eventData.location_name,
      });

      // Fetch ticket passes with guest details including CNIC
      const { data: passes, error: passesError } = await supabase
        .from("ticket_passes")
        .select(
          `
          code,
          guest_name,
          cnic_last4,
          ticket_type:ticket_types (
            name
          )
        `,
        )
        .eq("booking_id", bookingId)
        .order("issued_at", { ascending: true });

      if (passesError) {
        console.error("[dispatcher] Failed to fetch passes:", passesError);
        return null;
      }

      console.log("[dispatcher] Passes fetched:", {
        count: passes?.length || 0,
      });

      // Format event date and time
      const eventDate = new Date(eventData.start_time);
      const formattedDate = eventDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = eventDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Extract event location
      const venueName = eventData.location_name || "To be announced";
      const venueAddress = eventData.address || "Check your tickets";

      console.log("[dispatcher] Location info:", { venueName, venueAddress });

      // Generate HTML
      const premiumHtml = generateBookingConfirmationEmail({
        customerName: booking.customer_name || "Valued Customer",
        bookingReference: booking.booking_reference || "N/A",
        eventName: eventData.name,
        eventDate: formattedDate,
        eventTime: formattedTime,
        eventVenue: `${venueName}, ${venueAddress}`,
        ticketCount: passes?.length || 0,
        totalAmount: booking.total_amount || 0,
        passes:
          passes?.map((pass) => ({
            code: pass.code,
            guestName: pass.guest_name,
            cnicLast4: pass.cnic_last4,
            ticketTypeName:
              (pass.ticket_type as { name: string } | null)?.name ||
              "General Admission",
          })) || [],
        viewTicketsUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings`,
      });

      console.log("[dispatcher] Premium HTML generated successfully");
      return premiumHtml;
    } catch (error) {
      console.error("[dispatcher] Error building custom email:", error);
      console.error("[dispatcher] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  // Default: no custom template
  console.log(
    "[dispatcher] Using default template for category:",
    notification.category_slug,
  );
  return null;
}

async function handleDispatchFailure(
  supabase: ServiceSupabaseClient,
  row: EmailOutboxRow,
  channel: EmailChannelRecord,
  notification: NotificationRecord & { recipient_profile: RecipientProfile },
  lockToken: string,
  attemptIso: string,
  error: unknown,
): Promise<"failed" | "deferred"> {
  const nextRetryCount = (row.retry_count ?? 0) + 1;
  const serializedError = serializeErrorDetails(error);
  const hasRetriesLeft =
    nextRetryCount < MAX_RETRY_ATTEMPTS && isRetryableError(error);

  const { error: channelError } = await supabase
    .from("notification_channels")
    .update({
      status: hasRetriesLeft ? "pending" : "failed",
      last_attempted_at: attemptIso,
      attempt_count: (channel.attempt_count ?? 0) + 1,
      error: serializedError,
    })
    .eq("id", channel.id);

  if (channelError) {
    throw new NotificationDispatchError(
      `Failed to update channel ${channel.id} after error: ${channelError.message}`,
      channelError,
    );
  }

  const outboxUpdate: Record<string, unknown> = {
    retry_count: nextRetryCount,
    last_error: serializedError,
    locked_at: null,
    locked_by: null,
    updated_at: attemptIso,
    status: hasRetriesLeft ? "pending" : "failed",
    next_attempt_at: hasRetriesLeft
      ? new Date(Date.now() + getBackoffDelayMs(nextRetryCount)).toISOString()
      : null,
  };

  const { error: outboxError } = await supabase
    .from("notification_outbox")
    .update(outboxUpdate)
    .eq("id", row.id)
    .eq("locked_by", lockToken);

  if (outboxError) {
    throw new NotificationDispatchError(
      `Failed to persist outbox failure for ${row.id}: ${outboxError.message}`,
      outboxError,
    );
  }

  await safeLogFailure(
    notification.id,
    channel.id,
    hasRetriesLeft ? "deferred" : "failed",
    nextRetryCount,
    row.id,
    error,
    outboxUpdate.next_attempt_at as string | null,
  );

  return hasRetriesLeft ? "deferred" : "failed";
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}

export async function dispatchEmailOutboxBatch(
  options?: DispatchOptions,
): Promise<DispatchSummary> {
  const supabase =
    options?.supabase ?? (await createServerSupabase({ useServiceRole: true }));
  const limit = clampLimit(options?.limit);
  const now = new Date();
  const recoveredLocks = await releaseStaleLocks(
    supabase,
    new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString(),
  );

  const rows = await fetchEmailOutboxRows(supabase, limit, now);

  const summary: DispatchSummary = {
    attempted: 0,
    sent: 0,
    deferred: 0,
    failed: 0,
    skipped: 0,
    recoveredLocks,
    errors: [],
  };

  if (!rows.length) {
    return summary;
  }

  const recipientCache = new Map<string, RecipientInfo>();

  for (const row of rows) {
    const channel = row.notification_channel;
    if (!channel || channel.channel !== "email" || !channel.notification) {
      summary.skipped += 1;
      continue;
    }

    const notification = channel.notification;
    if (!notification) {
      summary.skipped += 1;
      continue;
    }

    const lockToken = randomUUID();
    const locked = await attemptLockOutboxRow(supabase, row.id, lockToken);
    if (!locked) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;
    const attemptIso = new Date().toISOString();

    try {
      const recipient = await getRecipientInfo(
        supabase,
        notification,
        recipientCache,
      );

      if (!recipient.email) {
        throw new NotificationEmailError("Recipient email is required");
      }

      const sendResult = await sendNotificationEmail({
        notification,
        recipient: {
          email: recipient.email,
          fullName: recipient.fullName ?? undefined,
        },
        customHtml:
          (await buildCustomEmailHtml(supabase, notification)) ?? undefined,
      });

      await markChannelSuccess(
        supabase,
        channel,
        attemptIso,
        sendResult.providerMessageId ?? null,
      );
      await markOutboxSuccess(supabase, row.id, lockToken, attemptIso);
      await safeLogSent(
        notification.id,
        row.id,
        sendResult.providerMessageId ?? null,
      );
      summary.sent += 1;
    } catch (error) {
      try {
        const outcome = await handleDispatchFailure(
          supabase,
          row,
          channel,
          notification,
          lockToken,
          attemptIso,
          error,
        );
        if (outcome === "failed") {
          summary.failed += 1;
          summary.errors.push({
            outboxId: row.id,
            message: formatError(error),
          });
        } else {
          summary.deferred += 1;
        }
      } catch (innerError) {
        summary.failed += 1;
        summary.errors.push({
          outboxId: row.id,
          message: formatError(innerError),
        });
      }
    }
  }

  return summary;
}

export class EmailDispatchError extends NotificationDispatchError {}
