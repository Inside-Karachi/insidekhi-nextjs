import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/bookings/{id}
 *
 * Owner-scoped booking detail. Ownership is enforced in the query itself
 * (`user_id = caller`) and a non-owned/unknown id returns 404 (not 403) to
 * avoid existence disclosure. The response is an explicit allow-list - it never
 * includes `cnic_hash`, `verification_seed`, `customer_email`, or
 * `customer_phone` (see mobile API section 1.1).
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const bookingId = parsePathId((await params).id, "id");

  const { rows } = await query(
    `SELECT id, booking_reference, event_id, total_amount, payment_status, status,
            customer_name, cnic_last4, expires_at, created_at
     FROM bookings
     WHERE id = $1 AND user_id = $2`,
    [bookingId, user.id],
  );
  const booking = rows[0];

  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }

  return ok({ ...booking, currency: "PKR" });
});
