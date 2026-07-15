import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";
import {
  BOOKING_COLUMN_KEYS,
  toBooking,
  type BookingRow,
} from "@/lib/mobile/commerce";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/bookings
 *
 * The caller's own bookings, newest first (explicit user_id filter - no RLS
 * on direct Postgres). Redacted DTO - never cnic_hash / verification_seed /
 * email / phone / user_id. Mirrors `app/api/tickets` (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { rows } = await query(
    `SELECT ${BOOKING_COLUMN_KEYS.join(", ")}
     FROM bookings
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id],
  );

  return ok((rows as unknown as BookingRow[]).map(toBooking));
});
