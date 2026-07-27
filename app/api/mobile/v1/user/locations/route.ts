import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/user/locations
 *
 * Lists the caller's saved locations (Home/Work/Current/Custom), active first.
 * Mirrors `app/api/user/locations` (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const { rows } = await query(
    `SELECT id, label, custom_label, address, latitude, longitude, is_active, created_at
     FROM public.user_saved_locations
     WHERE user_id = $1
     ORDER BY is_active DESC, created_at ASC`,
    [user.id],
  );

  return ok({ locations: rows });
});

const createLocationSchema = z.object({
  label: z.enum(["home", "work", "current", "custom"]),
  customLabel: z.string().max(60).optional(),
  address: z.string().min(1).max(512),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  setActive: z.boolean().default(true),
});

/**
 * POST /api/mobile/v1/user/locations
 *
 * Saves a new location for the caller. Defaults to making it the active one.
 * Mirrors `app/api/user/locations` (POST).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = createLocationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      parsed.error.errors[0]?.message ?? "Invalid location payload.",
      400,
      parsed.error.errors[0]?.path.join(".") || undefined,
    );
  }
  const body = parsed.data;

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
      user.id,
      body.setActive,
      body.label,
      body.customLabel ?? null,
      body.address,
      body.latitude,
      body.longitude,
    ],
  );

  return ok({ location: rows[0] }, undefined, { status: 201 });
});
