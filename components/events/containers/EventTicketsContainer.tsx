
import { createServerSupabase } from "@/lib/supabase/server";
import { EventTicketSection } from "@/components/events/EventTicketSection";
import { Event } from "@/types/events.types";

interface EventTicketsContainerProps {
    event: Event;
}

export async function EventTicketsContainer({
    event,
}: EventTicketsContainerProps) {
    const supabase = await createServerSupabase({ publicAnon: true });

    const { data: ticketTypes } = await supabase
        .from("ticket_types")
        .select("*")
        .eq("event_id", event.id)
        .order("price", { ascending: true });

    if (!ticketTypes || ticketTypes.length === 0) {
        return null;
    }

    return (
        <EventTicketSection event={event} ticketTypes={ticketTypes} />
    );
}
