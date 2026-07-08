import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicPass } from "@/types/ticketing.types";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const bookingIdParam = url.searchParams.get("booking_id");
    if (!bookingIdParam) {
      return NextResponse.json(
        { error: "booking_id required" },
        { status: 400 }
      );
    }
    const bookingId = Number(bookingIdParam);
    if (Number.isNaN(bookingId)) {
      return NextResponse.json(
        { error: "invalid booking_id" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Fetch booking to enforce ownership
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, user_id, booking_reference, payment_status, total_amount")
      .eq("id", bookingId)
      .single();
    if (!booking)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const paidStatuses = ["paid", "confirmed", "completed"];
    const isPaid = paidStatuses.includes(booking.payment_status ?? "");

    // Passes - only return full data (including codes) when payment is confirmed
    const { data: passes } = await supabase
      .from("ticket_passes")
      .select(
        "id, booking_id, code, status, quantity_index, issued_at, ticket_type_id"
      )
      .eq("booking_id", bookingId)
      .order("quantity_index", { ascending: true });

    const safePasses = isPaid
      ? ((passes || []) as PublicPass[])
      : (passes || []).map(({ code: _code, ...rest }) => rest) as PublicPass[];

    const result = {
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      payment_status: booking.payment_status,
      total_amount: booking.total_amount,
      passes: safePasses,
    };

    return NextResponse.json(result);
  } catch (_e) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
