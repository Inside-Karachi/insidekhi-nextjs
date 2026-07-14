import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

interface MarkNotificationPayload {
  archive?: boolean;
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ notificationId: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
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
    const archive = payload.archive ?? false;

    // The old mark_notification_read() RPC authorized itself via Supabase's
    // auth.uid() session GUC, which a direct pg connection never sets - so
    // the recipient_id filter below is what actually enforces ownership
    // here. Both "not found" and "not yours" collapse to the same zero-row
    // update, matching the old RPC's behavior of erroring either way (both
    // ended up surfacing as the same 500 response below).
    const { rows } = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, timezone('utc', now())),
           archived_at = CASE WHEN $1 THEN COALESCE(archived_at, timezone('utc', now())) ELSE archived_at END,
           updated_at = timezone('utc', now())
       WHERE id = $2 AND recipient_id = $3
       RETURNING id`,
      [archive, notificationId, session.userId]
    );

    if (rows.length === 0) {
      throw new Error(
        `Notification ${notificationId} not found or not authorized`
      );
    }

    const { rows: unreadRows } = await query(
      `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL`,
      [session.userId]
    );
    const unreadCount = parseInt(unreadRows[0].count, 10);

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
