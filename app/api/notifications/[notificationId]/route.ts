import { NextRequest, NextResponse } from "next/server";

import { getUnreadCount, markNotificationRead } from "@/lib/notifications";
import { createServerSupabase } from "@/lib/supabase/server";

interface MarkNotificationPayload {
  archive?: boolean;
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ notificationId: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationId } = await props.params;
    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID required" },
        { status: 400 }
      );
    }

    let payload: MarkNotificationPayload = {};
    if (request.headers.get("content-length")) {
      try {
        payload = (await request.json()) as MarkNotificationPayload;
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
    }

    await markNotificationRead(supabase, {
      notificationId,
      archive: payload.archive ?? false,
    });

    const { unreadCount } = await getUnreadCount(supabase, user.id);

    return NextResponse.json({ success: true, unreadCount });
  } catch (error) {
    // Note: params is Promise-based in Next.js 15; avoid referencing it directly here for logging
    console.error(`PATCH /api/notifications/[notificationId] failed`, error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
