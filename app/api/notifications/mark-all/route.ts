import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The old mark_all_notifications_read() RPC authorized itself via
    // Supabase's auth.uid() session GUC, which a direct pg connection never
    // sets - so the WHERE filter below (scoped to the caller's own session
    // id) is what actually enforces "only your own notifications" here.
    const { rows } = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, timezone('utc', now())),
           updated_at = timezone('utc', now())
       WHERE recipient_id = $1 AND read_at IS NULL
       RETURNING id`,
      [session.userId]
    );
    const count = rows.length;

    const { rows: unreadRows } = await query(
      `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read_at IS NULL AND archived_at IS NULL`,
      [session.userId]
    );
    const unreadCount = parseInt(unreadRows[0].count, 10);

    return NextResponse.json({ success: true, updated: count, unreadCount });
  } catch (error) {
    console.error("PATCH /api/notifications/mark-all failed", error);
    return NextResponse.json(
      { error: "Failed to mark notifications" },
      { status: 500 }
    );
  }
}
