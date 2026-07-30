import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/favorites?listingId=
 *
 * Whether the caller has favorited a listing. Unauthenticated callers always get
 * `{ favorited: false }`. Mirrors `app/api/favorites` (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { searchParams } = new URL(request.url);
  const listingId = parsePathId(
    searchParams.get("listingId") ?? undefined,
    "listingId",
  );

  const { user } = await getOptionalMobileUser(request);
  if (!user) return ok({ favorited: false });

  const { rows } = await query(
    `SELECT 1 FROM favorite_listings WHERE user_id = $1 AND listing_id = $2 LIMIT 1`,
    [user.id, listingId],
  );

  return ok({ favorited: rows.length > 0 });
});

const toggleSchema = z.object({
  listingId: z.number().int().positive(),
});

/**
 * POST /api/mobile/v1/favorites
 *
 * Toggles the caller's favorite for a listing: inserts if absent (-> favorited),
 * deletes if present (-> unfavorited). Ownership is enforced by the explicit
 * `user_id` filter below (scoped to the caller's own rows). Mirrors
 * `app/api/favorites` (POST) semantics.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A positive integer listingId is required.",
      400,
      "listingId",
    );
  }
  const { listingId } = parsed.data;

  const { rows: existing } = await query(
    `SELECT 1 FROM favorite_listings WHERE user_id = $1 AND listing_id = $2 LIMIT 1`,
    [user.id, listingId],
  );

  if (existing.length > 0) {
    await query(
      `DELETE FROM favorite_listings WHERE user_id = $1 AND listing_id = $2`,
      [user.id, listingId],
    );
    await logListingEvent(user.id, listingId, "unfavorite");
    return ok({ favorited: false });
  }

  // Insert branch: the listing must exist and be published.
  const { rows: listingRows } = await query(
    `SELECT id FROM listings_with_details WHERE id = $1 AND status = 'published'`,
    [listingId],
  );
  if (!listingRows[0]) {
    throw new MobileApiError(
      "not_found",
      "Listing not found.",
      404,
      "listingId",
    );
  }

  try {
    await query(
      `INSERT INTO favorite_listings (user_id, listing_id) VALUES ($1, $2)`,
      [user.id, listingId],
    );
  } catch (insError) {
    // Unique-PK violation = a concurrent insert already favorited it.
    const pgError = insError as { code?: string };
    if (pgError.code === "23505") return ok({ favorited: true });
    console.error("[mobile-api] favorite insert failed:", insError);
    throw new MobileApiError("internal_error", "Failed to add favorite.", 500);
  }

  await logListingEvent(user.id, listingId, "favorite");
  return ok({ favorited: true });
});

/**
 * Writes favorite/unfavorite straight into user_listing_events server-side
 * (rather than relying on the client's POST /listing-events) so this signal
 * lands even if the client misses it, and so unfavoriting - which deletes
 * the favorite_listings row - doesn't destroy the history entirely.
 * Best-effort: never let a logging failure fail the favorite toggle itself.
 */
async function logListingEvent(
  userId: string,
  listingId: number,
  eventType: "favorite" | "unfavorite",
): Promise<void> {
  try {
    await query(
      `INSERT INTO public.user_listing_events (user_id, listing_id, event_type)
       VALUES ($1, $2, $3)`,
      [userId, listingId, eventType],
    );
  } catch (error) {
    console.error("[mobile-api] favorite event logging failed:", error);
  }
}
