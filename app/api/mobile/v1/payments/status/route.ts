import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { deriveStateCode } from "@/lib/payments/status-map";
import type { BookingPaymentStatus } from "@/types/payments.types";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/payments/status?booking_id=
 *
 * Poll a booking's payment state. Owner-scoped in-query (-> 404 if not the
 * caller's). `pass_count` uses the caller's RLS client - `ticket_passes` is
 * visible to the owner only once paid, so it naturally reads 0 until then.
 * Mirrors `app/api/payments/status`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
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

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, booking_reference, payment_status")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bErr) {
    console.error("[mobile-api] status booking lookup failed:", bErr.message);
    throw new MobileApiError("internal_error", "Failed to load status.", 500);
  }
  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }

  const { count, error: cErr } = await supabase
    .from("ticket_passes")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId);
  if (cErr) {
    console.error("[mobile-api] status pass count failed:", cErr.message);
    throw new MobileApiError("internal_error", "Failed to load status.", 500);
  }
  const passCount = count ?? 0;

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
