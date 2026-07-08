import { NextRequest, NextResponse } from "next/server";

import { getUnreadCount, listNotifications } from "@/lib/notifications";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  NotificationChannel,
  NotificationFeedStatusFilter,
  NotificationPriority,
} from "@/types/notifications.types";

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseLimitParam(searchParams.get("limit"));
    const includeArchived = parseBooleanParam(
      searchParams.get("includeArchived")
    );
    const status = parseStatusParam(searchParams.get("status"));
    const channel = parseChannelParam(searchParams.get("channel"));
    const priority = parsePriorityParam(searchParams.get("priority"));
    const rawSearch = searchParams.get("search");
    const search =
      rawSearch && rawSearch.trim().length ? rawSearch.trim() : undefined;

    const listResult = await listNotifications(supabase, {
      profileId: user.id,
      cursor,
      limit,
      includeArchived,
      status,
      channel,
      priority,
      search,
    });

    // In production, hide any demo/sample notifications (metadata.demo === true)
    const filteredNotifications =
      process.env.NODE_ENV === "production"
        ? listResult.notifications.filter((n) => {
            const meta = n.metadata as unknown as { demo?: unknown } | null;
            return !(meta && typeof meta === "object" && meta.demo === true);
          })
        : listResult.notifications;

    const { unreadCount } = await getUnreadCount(supabase, user.id, {
      excludeDemo: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({
      notifications: filteredNotifications,
      meta: {
        hasMore: listResult.hasMore,
        nextCursor: listResult.nextCursor,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("GET /api/notifications failed", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}
