import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Admin API: List All Bookings with Complete Details
 *
 * Returns all bookings with event, user, ticket items, and guest details.
 * Only admins can access this endpoint.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // Check user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin =
      profile?.role === "admin" || profile?.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Use service role to bypass RLS for admin queries
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Fetch bookings with event info and more fields
    const { data: bookings, error: bookingsError } = await adminSupabase
      .from("bookings")
      .select(
        `
        id,
        booking_reference,
        payment_status,
        status,
        total_amount,
        created_at,
        customer_name,
        customer_email,
        customer_phone,
        cnic_last4,
        event_id,
        user_id,
        events (
          id,
          name,
          slug
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (bookingsError) {
      console.error("Fetch bookings error:", bookingsError);
      return NextResponse.json(
        { success: false, error: bookingsError.message },
        { status: 500 }
      );
    }

    // Fetch user profiles
    const userIds = [
      ...new Set((bookings || []).map((b) => b.user_id).filter(Boolean)),
    ] as string[];
    const { data: profiles } =
      userIds.length > 0
        ? await adminSupabase
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", userIds)
        : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Fetch booking items with ticket types
    const bookingIds = (bookings || []).map((b) => b.id);
    const { data: bookingItems } =
      bookingIds.length > 0
        ? await adminSupabase
            .from("booking_items")
            .select(
              `
              booking_id,
              quantity,
              price_per_ticket,
              ticket_type:ticket_type_id (
                id,
                name,
                price
              )
            `
            )
            .in("booking_id", bookingIds)
        : { data: [] };

    // Group booking items by booking_id
    const itemsMap = new Map<number, typeof bookingItems>();
    (bookingItems || []).forEach((item) => {
      const existing = itemsMap.get(item.booking_id) || [];
      existing.push(item);
      itemsMap.set(item.booking_id, existing);
    });

    // Fetch ticket passes (guest details) for paid bookings
    const { data: ticketPasses } =
      bookingIds.length > 0
        ? await adminSupabase
            .from("ticket_passes")
            .select(
              `
              booking_id,
              guest_name,
              guest_cnic,
              cnic_last4,
              code,
              status,
              checked_in_at,
              ticket_type:ticket_type_id (name)
            `
            )
            .in("booking_id", bookingIds)
        : { data: [] };

    // Group ticket passes by booking_id
    const passesMap = new Map<number, typeof ticketPasses>();
    (ticketPasses || []).forEach((pass) => {
      const existing = passesMap.get(pass.booking_id) || [];
      existing.push(pass);
      passesMap.set(pass.booking_id, existing);
    });

    // Transform the data with complete details
    const transformedBookings = (bookings || []).map((booking) => {
      const items = itemsMap.get(booking.id) || [];
      const passes = passesMap.get(booking.id) || [];
      const userProfile = profileMap.get(booking.user_id);

      // Calculate total tickets
      const totalTickets = items.reduce((sum, item) => sum + item.quantity, 0);

      // Normalize payment status (handle 'pending' -> 'awaiting_payment')
      let normalizedPaymentStatus = booking.payment_status;
      if (normalizedPaymentStatus === "pending") {
        normalizedPaymentStatus = "awaiting_payment";
      }

      return {
        id: booking.id,
        booking_reference: booking.booking_reference,
        payment_status: normalizedPaymentStatus,
        status: booking.status,
        total_amount: booking.total_amount,
        created_at: booking.created_at,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        cnic_last4: booking.cnic_last4,
        event: booking.events,
        user: userProfile || null,
        // Ticket details
        total_tickets: totalTickets,
        items: items.map((item) => ({
          quantity: item.quantity,
          price_per_ticket: item.price_per_ticket,
          ticket_type_name:
            (item.ticket_type as { name?: string })?.name || "Standard",
        })),
        // Guest details (from ticket_passes if available)
        // Only show last 4 digits of CNIC for privacy
        guests: passes.map((pass) => {
          // Get last 4 digits of CNIC (prefer cnic_last4, fallback to extracting from guest_cnic)
          let cnicLast4: string | null = null;
          if (pass.cnic_last4) {
            cnicLast4 = pass.cnic_last4;
          } else if (pass.guest_cnic) {
            // Extract last 4 characters from full CNIC
            const cnicClean = pass.guest_cnic.replace(/-/g, "");
            cnicLast4 = cnicClean.slice(-4);
          }

          return {
            name: pass.guest_name,
            cnic: cnicLast4,
            ticket_type: (pass.ticket_type as { name?: string })?.name,
            code: pass.code,
            status: pass.status,
            checked_in_at: pass.checked_in_at,
          };
        }),
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedBookings,
      userRole: profile?.role,
    });
  } catch (error) {
    console.error("Bookings list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
