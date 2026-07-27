import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { parsePathId } from "@/lib/mobile/params";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * PATCH /api/mobile/v1/user/locations/{id}
 *
 * Sets this saved location as the caller's active one. Owner-scoped (-> 404).
 * Mirrors `app/api/user/locations/[id]` (PATCH).
 */
export const PATCH = mobileRoute(
  async (request: NextRequest, context: RouteContext) => {
    await enforceMobileRateLimit(request);
    const { user } = await requireMobileUser(request);

    const { id } = await context.params;
    const locationId = parsePathId(id, "id");

    const { rows: owned } = await query(
      `SELECT 1 FROM public.user_saved_locations WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [locationId, user.id],
    );
    if (owned.length === 0) {
      throw new MobileApiError("not_found", "Location not found.", 404);
    }

    await query(
      `UPDATE public.user_saved_locations SET is_active = false, updated_at = now()
       WHERE user_id = $1 AND id != $2`,
      [user.id, locationId],
    );
    const { rows } = await query(
      `UPDATE public.user_saved_locations SET is_active = true, updated_at = now()
       WHERE id = $1
       RETURNING id, label, custom_label, address, latitude, longitude, is_active, created_at`,
      [locationId],
    );

    return ok({ location: rows[0] });
  },
);

/**
 * DELETE /api/mobile/v1/user/locations/{id}
 *
 * Removes a saved location. Owner-scoped (-> 404).
 * Mirrors `app/api/user/locations/[id]` (DELETE).
 */
export const DELETE = mobileRoute(
  async (request: NextRequest, context: RouteContext) => {
    await enforceMobileRateLimit(request);
    const { user } = await requireMobileUser(request);

    const { id } = await context.params;
    const locationId = parsePathId(id, "id");

    const { rowCount } = await query(
      `DELETE FROM public.user_saved_locations WHERE id = $1 AND user_id = $2`,
      [locationId, user.id],
    );

    if (rowCount === 0) {
      throw new MobileApiError("not_found", "Location not found.", 404);
    }

    return ok({ success: true });
  },
);
