import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";

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

  const { user, supabase } = await getOptionalMobileUser(request);
  if (!user) return ok({ favorited: false });

  const { data, error } = await supabase
    .from("favorite_listings")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (error) {
    console.error("[mobile-api] favorite lookup failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load favorite.", 500);
  }

  return ok({ favorited: data != null });
});

const toggleSchema = z.object({
  listingId: z.number().int().positive(),
});

/**
 * POST /api/mobile/v1/favorites
 *
 * Toggles the caller's favorite for a listing: inserts if absent (-> favorited),
 * deletes if present (-> unfavorited). Ownership is enforced by RLS (the user can
 * only touch their own `favorite_listings` rows), so no service-role client is
 * needed. Mirrors `app/api/favorites` (POST) semantics.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);

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

  const { data: existing, error: selError } = await supabase
    .from("favorite_listings")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (selError) {
    console.error("[mobile-api] favorite select failed:", selError.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to update favorite.",
      500,
    );
  }

  if (existing) {
    const { error: delError } = await supabase
      .from("favorite_listings")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);
    if (delError) {
      console.error("[mobile-api] favorite delete failed:", delError.message);
      throw new MobileApiError(
        "internal_error",
        "Failed to remove favorite.",
        500,
      );
    }
    return ok({ favorited: false });
  }

  // Insert branch: the listing must exist and be published (RLS on the view
  // already hides non-published listings from regular callers).
  const { data: listing } = await supabase
    .from("listings_with_details")
    .select("id")
    .eq("id", listingId)
    .eq("status", "published")
    .maybeSingle();
  if (!listing) {
    throw new MobileApiError(
      "not_found",
      "Listing not found.",
      404,
      "listingId",
    );
  }

  const { error: insError } = await supabase
    .from("favorite_listings")
    .insert({ user_id: user.id, listing_id: listingId });
  if (insError) {
    // Unique-PK violation = a concurrent insert already favorited it.
    if (insError.code === "23505") return ok({ favorited: true });
    console.error("[mobile-api] favorite insert failed:", insError.message);
    throw new MobileApiError("internal_error", "Failed to add favorite.", 500);
  }

  return ok({ favorited: true });
});
