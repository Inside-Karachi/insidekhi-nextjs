import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  BookingsDashboard,
  DashboardBooking,
} from "@/components/dashboard/BookingsDashboard";
import { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  ticket_passes?: Array<
    Pick<
      Database["public"]["Tables"]["ticket_passes"]["Row"],
      | "id"
      | "booking_id"
      | "code"
      | "status"
      | "quantity_index"
      | "issued_at"
      | "ticket_type_id"
      | "guest_name"
      | "cnic_last4"
    >
  >;
};

type EventDetails = {
  event_id: number;
  event_name: string | null;
  event_slug: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
};

type EventsWithDetailsRow = {
  event_id: number | null;
  event_name: string | null;
  event_slug: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
};

export default async function DashboardBookingsPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: bookingsData, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      `
        id,
        booking_reference,
        payment_status,
        status,
        total_amount,
        created_at,
        event_id,
        ticket_passes (
          id,
          booking_id,
          code,
          status,
          quantity_index,
          issued_at,
          ticket_type_id,
          guest_name,
          cnic_last4
        )
      `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (bookingsError) {
    console.error("Failed to load bookings for dashboard", bookingsError);
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center px-4">
        <p className="text-lg font-medium">Unable to load bookings</p>
        <p className="text-sm text-muted-foreground">
          Something went wrong fetching your bookings. Please try refreshing the
          page.
        </p>
      </div>
    );
  }

  const bookings = (bookingsData ?? []) as BookingRow[];

  const eventIds = Array.from(
    new Set(
      bookings
        .map((booking) => booking.event_id)
        .filter((value): value is number => typeof value === "number"),
    ),
  );

  let eventsMap = new Map<number, EventDetails>();

  if (eventIds.length > 0) {
    const { data: eventsRows, error: eventsError } = await supabase
      .from("events_with_details")
      .select(
        `
          event_id,
          event_name,
          event_slug,
          start_time,
          end_time,
          location_name
        `,
      )
      .in("event_id", eventIds);

    if (eventsError) {
      console.error("Failed to load event details for bookings", eventsError);
    } else if (eventsRows) {
      const rows = eventsRows as EventsWithDetailsRow[];
      eventsMap = new Map(
        rows
          .filter((row) => row?.event_id)
          .map((row) => [
            row.event_id!,
            {
              event_id: row.event_id!,
              event_name: row.event_name,
              event_slug: row.event_slug,
              start_time: row.start_time,
              end_time: row.end_time,
              location_name: row.location_name,
            },
          ]),
      );
    }
  }

  const normalizedBookings: DashboardBooking[] = bookings.map((booking) => {
    const event = booking.event_id
      ? (eventsMap.get(booking.event_id) ?? null)
      : null;
    const passes = [...(booking.ticket_passes ?? [])].sort(
      (a, b) => a.quantity_index - b.quantity_index,
    );

    return {
      id: booking.id,
      booking_reference: booking.booking_reference,
      payment_status: booking.payment_status,
      status: booking.status,
      total_amount: booking.total_amount,
      created_at: booking.created_at,
      passes: passes.map((pass) => ({
        id: pass.id,
        booking_id: pass.booking_id,
        code: pass.code,
        status: pass.status,
        quantity_index: pass.quantity_index,
        issued_at: pass.issued_at,
        ticket_type_id: pass.ticket_type_id,
        guest_name: pass.guest_name,
        cnic_last4: pass.cnic_last4,
      })),
      event: event
        ? {
            id: event.event_id,
            name: event.event_name ?? "",
            slug: event.event_slug ?? "",
            start_time: event.start_time ?? "",
            end_time: event.end_time,
            venue_name: event.location_name,
          }
        : null,
    };
  });

  return <BookingsDashboard bookings={normalizedBookings} />;
}
