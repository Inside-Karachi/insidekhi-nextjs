import { NextResponse } from "next/server";

import { getUnreadCount, markAllNotificationsRead } from "@/lib/notifications";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await markAllNotificationsRead(supabase, user.id);
    const { unreadCount } = await getUnreadCount(supabase, user.id);

    return NextResponse.json({ success: true, updated: count, unreadCount });
  } catch (error) {
    console.error("PATCH /api/notifications/mark-all failed", error);
    return NextResponse.json(
      { error: "Failed to mark notifications" },
      { status: 500 }
    );
  }
}
