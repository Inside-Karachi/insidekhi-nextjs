import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  BOOKING_COLUMNS,
  toBooking,
  type BookingRow,
} from "@/lib/mobile/commerce";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/bookings
 *
 * The caller's own bookings, newest first (RLS scopes `bookings` SELECT to the
 * owner). Redacted DTO - never cnic_hash / verification_seed / email / phone /
 * user_id. Mirrors `app/api/tickets` (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<BookingRow[]>();
  if (error) {
    console.error("[mobile-api] bookings list failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load bookings.", 500);
  }

  return ok((data ?? []).map(toBooking));
});
