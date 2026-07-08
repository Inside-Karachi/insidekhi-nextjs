import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface TicketPassRecord {
  id: number;
  code: string;
  status: string;
  guest_name?: string | null;
  guest_cnic?: string | null;
  cnic_last4?: string | null;
  checked_in_at?: string | null;
  issued_at?: string | null;
  quantity_index?: number | null;
  booking?: {
    id: number;
    user_id: string;
    created_at: string;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    buyer?: {
      full_name?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  ticket_type?: {
    name: string;
    price: number | string;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns this event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, organizer_id")
      .eq("id", parseInt(eventId, 10))
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if user is organizer or admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin =
      profile?.role === "admin" || profile?.role === "super_admin";
    const isOrganizer = event.organizer_id === user.id;

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get all ticket passes for this event
    // Note: profiles table doesn't have email - get customer_email from bookings
    const { data: passes, error: passesError } = await supabase
      .from("ticket_passes")
      .select(
        `
        id,
        code,
        status,
        guest_name,
        guest_cnic,
        cnic_last4,
        checked_in_at,
        issued_at,
        quantity_index,
        booking:booking_id(
          id,
          user_id,
          created_at,
          customer_name,
          customer_email,
          customer_phone,
          buyer:user_id(full_name, phone)
        ),
        ticket_type:ticket_type_id(name, price)
      `
      )
      .eq("event_id", parseInt(eventId, 10))
      .order("issued_at", { ascending: false });

    if (passesError) {
      console.error("Passes fetch error:", passesError);
      return NextResponse.json(
        { error: "Failed to fetch attendees" },
        { status: 500 }
      );
    }

    // Format attendees - use customer_email from booking, fallback to profile data
    const attendees = ((passes as unknown as TicketPassRecord[]) || []).map(
      (pass) => ({
        id: pass.id,
        code: pass.code,
        status: pass.status,
        guestName:
          pass.guest_name ||
          pass.booking?.customer_name ||
          pass.booking?.buyer?.full_name ||
          "Unknown",
        guestCnic:
          pass.cnic_last4 ||
          (pass.guest_cnic ? pass.guest_cnic.slice(-4) : null),
        guestCnicFormatted: pass.cnic_last4
          ? `*****-*******-${pass.cnic_last4.slice(0, 1)}`
          : null,
        ticketType: pass.ticket_type?.name || "Standard",
        price: pass.ticket_type?.price || 0,
        checkedInAt: pass.checked_in_at,
        issuedAt: pass.issued_at,
        buyerEmail: pass.booking?.customer_email,
        buyerPhone: pass.booking?.customer_phone || pass.booking?.buyer?.phone,
      })
    );

    // Calculate stats
    const stats = {
      total: attendees.length,
      checkedIn: attendees.filter((a) => a.status === "checked_in").length,
      pending: attendees.filter((a) => a.status === "issued").length,
    };

    return NextResponse.json({
      event: { id: event.id, name: event.name },
      attendees,
      stats,
    });
  } catch (error) {
    console.error("Attendees fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
