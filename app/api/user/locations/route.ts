import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/user/locations
 * List the caller's saved locations (Home/Work/Current/Custom), active first.
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { rows } = await query(
      `SELECT id, label, custom_label, address, latitude, longitude, is_active, created_at
       FROM public.user_saved_locations
       WHERE user_id = $1
       ORDER BY is_active DESC, created_at ASC`,
      [session.userId],
    );

    return NextResponse.json({ locations: rows });
  } catch (error) {
    console.error("Failed to list saved locations:", error);
    return NextResponse.json(
      { error: "Failed to load saved locations" },
      { status: 500 },
    );
  }
}

const createLocationSchema = z.object({
  label: z.enum(["home", "work", "current", "custom"]),
  customLabel: z.string().max(60).optional(),
  address: z.string().min(1).max(512),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  setActive: z.boolean().default(true),
});

/**
 * POST /api/user/locations
 * Save a new location for the caller. Defaults to making it the active one.
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body;
  try {
    body = createLocationSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request payload", details: error },
      { status: 400 },
    );
  }

  try {
    const { rows } = await query(
      `WITH deactivated AS (
         UPDATE public.user_saved_locations
         SET is_active = false, updated_at = now()
         WHERE user_id = $1 AND $2 = true
       )
       INSERT INTO public.user_saved_locations
         (user_id, label, custom_label, address, latitude, longitude, is_active)
       VALUES ($1, $3, $4, $5, $6, $7, $2)
       RETURNING id, label, custom_label, address, latitude, longitude, is_active, created_at`,
      [
        session.userId,
        body.setActive,
        body.label,
        body.customLabel ?? null,
        body.address,
        body.latitude,
        body.longitude,
      ],
    );

    return NextResponse.json({ location: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Failed to save location:", error);
    return NextResponse.json(
      { error: "Failed to save location" },
      { status: 500 },
    );
  }
}
