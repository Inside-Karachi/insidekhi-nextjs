import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  fetchPayFastToken,
  generatePayFastFormFields,
  formatPayFastOrderDate,
  formatPayFastMobile,
  getPayFastTransactionUrl,
  isPayFastConfigured,
} from "@/lib/payments/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  basketId: z.string().min(1), // the booking_reference (see below)
  customerMobile: z.string().min(1).max(40),
  customerEmail: z.string().email(),
  transactionDescription: z.string().max(255).optional().default("Checkout"),
});

/**
 * POST /api/mobile/v1/payments/token
 *
 * Builds the server-signed PayFast form fields for a booking. The client sends
 * its `booking_reference` as `basketId`; we resolve the booking (owner-scoped
 * in-query -> 404) and pass the booking's STORED `basket_id` (a hash) to PayFast,
 * so the eventual server-to-server callback - which finds the booking by
 * `basket_id` - resolves. Amount is derived from the DB (client amount ignored).
 * No service role needed (the caller reads its own booking via RLS). Mirrors
 * `app/api/payment/payfast/token`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "basketId, customerMobile, and a valid customerEmail are required.",
      400,
      parsed.error.errors[0]?.path.join(".") || undefined,
    );
  }
  const { basketId, customerMobile, customerEmail, transactionDescription } =
    parsed.data;

  const { rows: bookingRows } = await query(
    `SELECT id, total_amount, basket_id, payment_status, expires_at
     FROM bookings WHERE booking_reference = $1 AND user_id = $2`,
    [basketId, user.id],
  );
  const booking = bookingRows[0];
  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }
  if (booking.payment_status === "paid") {
    throw new MobileApiError(
      "already_paid",
      "This booking has already been paid.",
      400,
    );
  }
  if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
    throw new MobileApiError(
      "booking_expired",
      "This booking has expired. Resume it before paying.",
      410,
    );
  }
  if (!booking.basket_id) {
    throw new MobileApiError(
      "internal_error",
      "Booking is not ready for payment.",
      500,
    );
  }

  if (!isPayFastConfigured()) {
    console.error("[mobile-api] PayFast is not configured (missing PAYFAST_* env).");
    throw new MobileApiError(
      "payment_not_configured",
      "Payments are not configured on this server.",
      503,
    );
  }

  const amount = Number(booking.total_amount).toFixed(2);
  const base = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
  const successUrl =
    process.env.NEXT_PUBLIC_PAYFAST_SUCCESS_URL || `${base}/checkout/success`;
  const failureUrl =
    process.env.NEXT_PUBLIC_PAYFAST_FAILURE_URL || `${base}/checkout/failed`;
  const checkoutUrl = `${base}/api/payments/payfast/callback`;

  const userAgent =
    request.headers.get("user-agent") || "InsideKarachi-MobileApp/1.0";
  const fwd = request.headers.get("x-forwarded-for");
  const userIp = fwd
    ? fwd.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "127.0.0.1";

  let tokenResponse;
  try {
    tokenResponse = await fetchPayFastToken(booking.basket_id, amount);
  } catch (err) {
    console.error(
      "[mobile-api] PayFast token fetch failed:",
      err instanceof Error ? err.message : err,
    );
    throw new MobileApiError(
      "payment_gateway_error",
      "Could not start the payment. Please try again.",
      502,
    );
  }

  const formFields = generatePayFastFormFields({
    token: tokenResponse.ACCESS_TOKEN,
    basketId: booking.basket_id,
    amount,
    customerMobile: formatPayFastMobile(customerMobile),
    customerEmail,
    orderDate: formatPayFastOrderDate(),
    transactionDescription,
    successUrl,
    failureUrl,
    checkoutUrl,
    userAgent,
    userIp,
  });

  return ok({
    formFields,
    transactionUrl: getPayFastTransactionUrl(),
    generatedAt: tokenResponse["GENERATED DATE TIME"],
  });
});
