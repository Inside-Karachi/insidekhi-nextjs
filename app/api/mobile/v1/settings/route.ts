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
 * User settings = the `profiles.user_preferences` JSON blob. Shape mirrors the
 * website's `app/api/user/settings` schema (theme / notifications / location).
 */
const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      bookings: z.boolean().optional(),
      reviews: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  location: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

type Settings = z.infer<typeof settingsSchema>;

/**
 * GET /api/mobile/v1/settings
 *
 * The caller's preferences. Returns `{}` when none are set yet.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  let data;
  try {
    const result = await query(
      `SELECT user_preferences FROM profiles WHERE id = $1`,
      [user.id],
    );
    data = result.rows[0];
  } catch (error) {
    console.error(
      "[mobile-api] settings fetch failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load settings.", 500);
  }

  return ok((data?.user_preferences as Settings | null) ?? {});
});

const updateSchema = z.object({ userPreferences: settingsSchema });

/**
 * PATCH /api/mobile/v1/settings
 *
 * Body `{ userPreferences: <partial Settings> }`. The partial is deep-merged
 * into the stored preferences (top-level keys plus the nested `notifications` /
 * `location` objects) so updating one field never wipes the others - unlike the
 * website route, which replaces the whole blob.
 */
export const PATCH = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MobileApiError(
      "validation_error",
      first?.message ?? "Invalid settings.",
      400,
      first?.path.join("."),
    );
  }
  const patch = parsed.data.userPreferences;

  let existingRow;
  try {
    const result = await query(
      `SELECT user_preferences FROM profiles WHERE id = $1`,
      [user.id],
    );
    existingRow = result.rows[0];
  } catch (readError) {
    console.error(
      "[mobile-api] settings read failed:",
      readError instanceof Error ? readError.message : readError,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to update settings.",
      500,
    );
  }
  const existing = (existingRow?.user_preferences as Settings | null) ?? {};

  const merged: Settings = {
    ...existing,
    ...patch,
    ...(existing.notifications || patch.notifications
      ? {
          notifications: {
            ...existing.notifications,
            ...patch.notifications,
          },
        }
      : {}),
    ...(existing.location || patch.location
      ? { location: { ...existing.location, ...patch.location } }
      : {}),
  };

  let data;
  try {
    const result = await query(
      `UPDATE profiles
       SET user_preferences = $1, updated_at = $2
       WHERE id = $3
       RETURNING user_preferences`,
      [JSON.stringify(merged), new Date().toISOString(), user.id],
    );
    data = result.rows[0];
  } catch (error) {
    console.error(
      "[mobile-api] settings update failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to update settings.",
      500,
    );
  }

  return ok((data?.user_preferences as Settings | null) ?? merged);
});
