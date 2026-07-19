import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { deriveStateCode } from "@/lib/payments/status-map";
import type { BookingPaymentStatus } from "@/types/payments.types";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/payments/status?booking_id=
 *
 * Poll a booking's payment state. Owner-scoped in-query (-> 404 if not the
 * caller's). `pass_count` is only fetched for paid bookings (previously
 * enforced by RLS - `ticket_passes` visible to the owner only once paid - now
 * an explicit guard since direct Postgres has no RLS), so it naturally reads
 * 0 until then. Mirrors `app/api/payments/status`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const idRaw = new URL(request.url).searchParams.get("booking_id");
  const bookingId = Number(idRaw);
  if (!idRaw || !Number.isInteger(bookingId) || bookingId < 1) {
    throw new MobileApiError(
      "validation_error",
      "A valid booking_id is required.",
      400,
      "booking_id",
    );
  }

  const { rows: bookingRows } = await query(
    `SELECT id, booking_reference, payment_status
     FROM bookings WHERE id = $1 AND user_id = $2`,
    [bookingId, user.id],
  );
  const booking = bookingRows[0];
  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }

  let passCount = 0;
  if (booking.payment_status === "paid") {
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS count FROM ticket_passes WHERE booking_id = $1`,
      [bookingId],
    );
    passCount = countRows[0]?.count ?? 0;
  }

  return ok({
    booking_id: booking.id,
    booking_reference: booking.booking_reference,
    payment_status: booking.payment_status,
    passes_issued: passCount > 0,
    pass_count: passCount,
    state_code: deriveStateCode(
      (booking.payment_status ?? "pending") as BookingPaymentStatus,
    ),
  });
});
