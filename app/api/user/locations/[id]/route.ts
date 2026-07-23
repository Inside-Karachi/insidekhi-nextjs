import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * PATCH /api/user/locations/:id
 * Set this saved location as the caller's active one.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const locationId = Number((await params).id);
  if (!locationId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const { rows: owned } = await query(
      `SELECT 1 FROM public.user_saved_locations WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [locationId, session.userId],
    );
    if (owned.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await query(
      `UPDATE public.user_saved_locations SET is_active = false, updated_at = now()
       WHERE user_id = $1 AND id != $2`,
      [session.userId, locationId],
    );
    const { rows } = await query(
      `UPDATE public.user_saved_locations SET is_active = true, updated_at = now()
       WHERE id = $1
       RETURNING id, label, custom_label, address, latitude, longitude, is_active, created_at`,
      [locationId],
    );

    return NextResponse.json({ location: rows[0] });
  } catch (error) {
    console.error("Failed to activate location:", error);
    return NextResponse.json(
      { error: "Failed to activate location" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/locations/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const locationId = Number((await params).id);
  if (!locationId) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const { rowCount } = await query(
      `DELETE FROM public.user_saved_locations WHERE id = $1 AND user_id = $2`,
      [locationId, session.userId],
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete location:", error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 },
    );
  }
}
