import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  PASS_COLUMNS,
  toPass,
  isBookingPaid,
  type PassRow,
} from "@/lib/mobile/commerce";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/tickets/passes?booking_id=
 *
 * The booking's passes. Owner-scoped in-query (-> 404). `ticket_passes` SELECT is
 * RLS-gated to paid bookings, so passes are empty until paid; `code` is withheld
 * until paid, and `signature`/`guest_cnic` are never selected. Mirrors
 * `app/api/tickets/passes`.
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
    .select("id, booking_reference, payment_status, total_amount")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bErr) {
    console.error("[mobile-api] passes booking lookup failed:", bErr.message);
    throw new MobileApiError("internal_error", "Failed to load passes.", 500);
  }
  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }

  const paid = isBookingPaid(booking.payment_status);
  const { data: passes } = await supabase
    .from("ticket_passes")
    .select(PASS_COLUMNS)
    .eq("booking_id", bookingId)
    .order("quantity_index", { ascending: true })
    .returns<PassRow[]>();

  return ok({
    booking_id: booking.id,
    booking_reference: booking.booking_reference,
    payment_status: booking.payment_status,
    total_amount: booking.total_amount,
    passes: (passes ?? []).map((p) => toPass(p, paid)),
  });
});
