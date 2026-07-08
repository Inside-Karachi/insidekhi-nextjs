import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { deriveStateCode } from "@/lib/payments/status-map";
import { BookingPaymentStatus } from "@/types/payments.types";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const bookingIdParam = url.searchParams.get("booking_id");
  if (!bookingIdParam) {
    return NextResponse.json({ error: "booking_id required" }, { status: 400 });
  }
  const bookingId = Number(bookingIdParam);
  if (Number.isNaN(bookingId)) {
    return NextResponse.json(
      { error: "booking_id must be numeric" },
      { status: 400 }
    );
  }

  // Require authenticated session
  const authSupabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Use service role for the lookup but restrict by user_id to prevent IDOR
  const supabase = await createServerSupabase({ useServiceRole: true });
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, booking_reference, payment_status")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .single();
  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { count: passCount } = await supabase
    .from("ticket_passes")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId);

  return NextResponse.json({
    booking_id: booking.id,
    booking_reference: booking.booking_reference,
    payment_status: booking.payment_status,
    passes_issued: !!passCount && passCount > 0,
    pass_count: passCount || 0,
    state_code: deriveStateCode(booking.payment_status as BookingPaymentStatus),
  });
}
