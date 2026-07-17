import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const { rows } = await query(
      "SELECT id, full_name, avatar_url, role, active_role FROM public.profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );

    const profile = rows[0];
    if (!profile) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: profile.id,
        email: session.email,
        role: profile.role,
        active_role: profile.active_role || profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      },
    });
  } catch (error) {
    console.error("Fetch current user API error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
