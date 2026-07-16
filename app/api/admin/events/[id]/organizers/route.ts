import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

async function requireAdminRole(userId: string) {
  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    userId,
  ]);
  const profile = rows[0];
  if (!profile) {
    return { error: "Profile not found", status: 403 } as const;
  }
  if (!ADMIN_ROLES.includes(profile.role)) {
    return { error: "Access denied", status: 403 } as const;
  }
  return { ok: true, role: profile.role } as const;
}

// GET: List eligible event organizers (minimal info)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    // Search users by query param (for autocomplete)
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const ownerId = searchParams.get("organizerId")?.trim();

    const whereClauses: string[] = ["role != 'super_admin'"];
    const queryParams: unknown[] = [];

    if (q) {
      queryParams.push(`%${q}%`);
      const idx = queryParams.length;
      whereClauses.push(`(full_name ILIKE $${idx} OR username ILIKE $${idx})`);
    }

    if (ownerId) {
      queryParams.push(ownerId);
      whereClauses.push(`id = $${queryParams.length}`);
    }

    let users;
    try {
      const { rows } = await query(
        `SELECT id, full_name, username, avatar_url, role
         FROM profiles
         WHERE ${whereClauses.join(" AND ")}
         LIMIT 10`,
        queryParams
      );
      users = rows;
    } catch (error) {
      console.error("[API][GET] Failed to fetch users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[API][GET] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Assign organizer to an event
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    // If lister, check ownership
    if (access.role === "lister") {
      const { rows } = await query(
        `SELECT id, organizer_id FROM events WHERE id = $1`,
        [eventId]
      );
      const event = rows[0];
      if (!event || event.organizer_id !== session.userId) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
    }

    // Parse new organizer from body
    const { organizer_id } = await request.json();
    if (!organizer_id) {
      return NextResponse.json(
        { error: "organizer_id is required" },
        { status: 400 }
      );
    }

    // Update event organizer
    try {
      await query(`UPDATE events SET organizer_id = $1 WHERE id = $2`, [
        organizer_id,
        eventId,
      ]);
    } catch (error) {
      console.error("Failed to update organizer:", error);
      return NextResponse.json(
        { error: "Failed to update organizer" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
