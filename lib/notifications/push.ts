import type { Json } from "@/types/database";

interface NotificationPushRecipient {
  tokens: string[];
}

export interface SendNotificationPushParams {
  recipient: NotificationPushRecipient;
  title: string;
  body: string;
  data?: Json;
}

export interface PushTicketResult {
  token: string;
  ok: boolean;
  /** Set when Expo reports the token as dead (uninstalled/unregistered). */
  deviceNotRegistered: boolean;
  error?: string;
}

export interface SendNotificationPushResult {
  tickets: PushTicketResult[];
}

export class NotificationPushError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NotificationPushError";
  }
}

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Sends one push to every token a recipient has registered (multi-device),
 * batched into a single Expo push API call. Expo's relay handles the actual
 * FCM/APNs delivery - no Firebase Admin SDK credentials needed here.
 */
export async function sendNotificationPush(
  params: SendNotificationPushParams,
): Promise<SendNotificationPushResult> {
  const { recipient, title, body, data } = params;

  if (recipient.tokens.length === 0) {
    throw new NotificationPushError("No push tokens for recipient");
  }

  const messages = recipient.tokens.map((token) => ({
    to: token,
    title,
    body,
    data: data ?? undefined,
    sound: "default",
  }));

  let response: Response;
  try {
    response = await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    throw new NotificationPushError("Expo push request failed", error);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new NotificationPushError(
      `Expo push API returned status ${response.status}: ${text}`,
    );
  }

  const json = (await response.json().catch(() => null)) as {
    data?: ExpoPushTicket[];
  } | null;

  const tickets = json?.data;
  if (!Array.isArray(tickets) || tickets.length !== recipient.tokens.length) {
    throw new NotificationPushError(
      "Expo push API returned an unexpected response shape",
    );
  }

  return {
    tickets: tickets.map((ticket, index) => ({
      token: recipient.tokens[index],
      ok: ticket.status === "ok",
      deviceNotRegistered:
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered",
      error: ticket.status === "error" ? ticket.message : undefined,
    })),
  };
}
