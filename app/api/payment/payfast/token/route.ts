/**
 * PayFast Token API Route
 *
 * POST /api/payment/payfast/token
 *
 * Generates complete PayFast form fields (server-side only).
 * This keeps the SECURED_KEY and crypto operations on the server.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchPayFastToken,
  generatePayFastFormFields,
  formatPayFastOrderDate,
  formatPayFastMobile,
  getPayFastTransactionUrl,
} from "@/lib/payments/payfast";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

// Input validation schema
const TokenRequestSchema = z.object({
  basketId: z.string().min(1, "Basket ID is required"),
  // amount is intentionally ignored - derived server-side from the DB booking
  amount: z.string().optional(),
  customerMobile: z.string().min(1, "Customer mobile is required"),
  customerEmail: z.string().email("Invalid email address"),
  transactionDescription: z.string().optional().default("Checkout"),
});

export async function POST(request: NextRequest) {
  try {
    // Require authenticated session
    const authSupabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = TokenRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const { basketId, customerMobile, customerEmail, transactionDescription } =
      validation.data;

    // Look up booking server-side and derive amount from DB (ignore client-supplied amount)
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });
    const { data: booking, error: bookingError } = await serviceSupabase
      .from("bookings")
      .select("id, user_id, total_amount")
      .eq("basket_id", basketId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const amount = Number(booking.total_amount).toFixed(2);

    // Extract User Agent and IP address
    const userAgent =
      request.headers.get("user-agent") || "InsideKarachi-NextApp/1.0";
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const userIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : realIp || "127.0.0.1";

    // Debug logging (dev mode only)
    if (process.env.NEXT_DEBUG === "true") {
      console.log("[PayFast Fraud Check]", {
        userAgent,
        userIp,
        forwardedFor,
        realIp,
      });
    }

    // 2. Fetch token from PayFast API (server-to-server)
    const tokenResponse = await fetchPayFastToken(basketId, amount);

    // 3. Get success/failure URLs from environment
    // Use NEXT_PUBLIC_APP_URL for production, fallback to localhost for development
    // Strip any trailing slash so concatenated paths don't become "//api/...".
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const successUrl =
      process.env.NEXT_PUBLIC_PAYFAST_SUCCESS_URL ||
      `${baseUrl}/checkout/success`;
    const failureUrl =
      process.env.NEXT_PUBLIC_PAYFAST_FAILURE_URL ||
      `${baseUrl}/checkout/failed`;
    // Server-to-server IPN destination - PayFast POSTs the backend payment
    // notification here. Without it, the live IPN has nowhere to land and the
    // booking would never be confirmed server-side.
    const checkoutUrl = `${baseUrl}/api/payments/payfast/callback`;

    // 4. Generate complete form fields (server-side, uses crypto)
    const formFields = generatePayFastFormFields({
      token: tokenResponse.ACCESS_TOKEN,
      basketId,
      amount,
      customerMobile: formatPayFastMobile(customerMobile),
      customerEmail,
      orderDate: formatPayFastOrderDate(),
      transactionDescription,
      successUrl,
      failureUrl,
      checkoutUrl,
      userAgent, // Fraud check field
      userIp, // Fraud check field
    });

    // 5. Return ready-to-use form fields to client
    return NextResponse.json({
      success: true,
      data: {
        formFields,
        transactionUrl: getPayFastTransactionUrl(),
        generatedAt: tokenResponse["GENERATED DATE TIME"],
      },
    });
  } catch (error) {
    console.error("[PayFast Token API] Error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to generate payment form";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
