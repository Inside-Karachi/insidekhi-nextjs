import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";

/**
 * Admin API: List All Bookings with Complete Details
 *
 * Returns all bookings with event, user, ticket items, and guest details.
 * Only admins can access this endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    let profile;
    try {
      ({ profile } = await requireAdmin(request));
    } catch (error) {
      const status = getAdminAuthErrorStatus(error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unauthorized",
        },
        { status: status ?? 500 }
      );
    }

    // Fetch bookings with event info and more fields
    const { rows: bookings } = await query(
      `SELECT b.id, b.booking_reference, b.payment_status, b.status, b.total_amount,
              b.created_at, b.customer_name, b.customer_email, b.customer_phone,
              b.cnic_last4, b.event_id, b.user_id,
              CASE WHEN e.id IS NULL THEN NULL
                   ELSE json_build_object('id', e.id, 'name', e.name, 'slug', e.slug)
              END AS events
       FROM bookings b
       LEFT JOIN events e ON e.id = b.event_id
       ORDER BY b.created_at DESC
       LIMIT 500`
    );

    // Fetch user profiles
    const userIds = [
      ...new Set(bookings.map((b) => b.user_id as string).filter(Boolean)),
    ];
    const { rows: profiles } =
      userIds.length > 0
        ? await query(
            `SELECT id, full_name, phone FROM profiles WHERE id = ANY($1::uuid[])`,
            [userIds]
          )
        : { rows: [] as { id: string; full_name: string; phone: string }[] };

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Fetch booking items with ticket types
    const bookingIds = bookings.map((b) => b.id as number);
    const { rows: bookingItems } =
      bookingIds.length > 0
        ? await query(
            `SELECT bi.booking_id, bi.quantity, bi.price_per_ticket,
                    CASE WHEN tt.id IS NULL THEN NULL
                         ELSE json_build_object('id', tt.id, 'name', tt.name, 'price', tt.price)
                    END AS ticket_type
             FROM booking_items bi
             LEFT JOIN ticket_types tt ON tt.id = bi.ticket_type_id
             WHERE bi.booking_id = ANY($1::int[])`,
            [bookingIds]
          )
        : { rows: [] as Record<string, unknown>[] };

    // Group booking items by booking_id
    const itemsMap = new Map<number, typeof bookingItems>();
    bookingItems.forEach((item) => {
      const bookingId = item.booking_id as number;
      const existing = itemsMap.get(bookingId) || [];
      existing.push(item);
      itemsMap.set(bookingId, existing);
    });

    // Fetch ticket passes (guest details) for paid bookings
    const { rows: ticketPasses } =
      bookingIds.length > 0
        ? await query(
            `SELECT tp.booking_id, tp.guest_name, tp.cnic_last4, tp.code,
                    tp.status, tp.checked_in_at,
                    CASE WHEN tt.id IS NULL THEN NULL
                         ELSE json_build_object('name', tt.name)
                    END AS ticket_type
             FROM ticket_passes tp
             LEFT JOIN ticket_types tt ON tt.id = tp.ticket_type_id
             WHERE tp.booking_id = ANY($1::int[])`,
            [bookingIds]
          )
        : { rows: [] as Record<string, unknown>[] };

    // Group ticket passes by booking_id
    const passesMap = new Map<number, typeof ticketPasses>();
    ticketPasses.forEach((pass) => {
      const bookingId = pass.booking_id as number;
      const existing = passesMap.get(bookingId) || [];
      existing.push(pass);
      passesMap.set(bookingId, existing);
    });

    // Transform the data with complete details
    const transformedBookings = bookings.map((booking) => {
      const bookingId = booking.id as number;
      const items = itemsMap.get(bookingId) || [];
      const passes = passesMap.get(bookingId) || [];
      const userProfile = profileMap.get(booking.user_id as string);

      // Calculate total tickets
      const totalTickets = items.reduce(
        (sum, item) => sum + (item.quantity as number),
        0
      );

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
          const cnicLast4 = (pass.cnic_last4 as string | null) ?? null;

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
