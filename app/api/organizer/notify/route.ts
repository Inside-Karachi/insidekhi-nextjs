import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

type NotificationType =
  | "ticket_sale"
  | "check_in"
  | "milestone"
  | "event_reminder";

interface NotifyOrganizerRequest {
  type: NotificationType;
  eventId: number;
  data?: {
    ticketCount?: number;
    totalAmount?: number;
    buyerName?: string;
    attendeeName?: string;
    milestonePercent?: number;
    hoursUntil?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const body: NotifyOrganizerRequest = await request.json();

    const { type, eventId, data } = body;

    if (!type || !eventId) {
      return NextResponse.json(
        { error: "type and eventId required" },
        { status: 400 }
      );
    }

    // Get event with organizer info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, organizer_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get organizer profile
    const { data: organizer } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", event.organizer_id)
      .single();

    const role = organizer?.role || "public_user";

    // Build notification based on type
    let title = "";
    let body_text = "";
    let categorySlug = "";
    let ctaUrl = `/dashboard/organizer`;

    switch (type) {
      case "ticket_sale":
        categorySlug = "organizer_ticket_sale";
        title = `🎫 New Ticket Sale for ${event.name}`;
        body_text = data?.buyerName
          ? `${data.buyerName} purchased ${
              data.ticketCount || 1
            } ticket(s) for PKR ${(data.totalAmount || 0).toLocaleString()}`
          : `${data?.ticketCount || 1} ticket(s) sold for PKR ${(
              data?.totalAmount || 0
            ).toLocaleString()}`;
        break;

      case "check_in":
        categorySlug = "organizer_check_in";
        title = `✓ Check-in at ${event.name}`;
        body_text = data?.attendeeName
          ? `${data.attendeeName} has checked in`
          : "An attendee has checked in to your event";
        break;

      case "milestone":
        categorySlug = "organizer_milestone";
        const percent = data?.milestonePercent || 0;
        if (percent >= 100) {
          title = `🎉 ${event.name} is SOLD OUT!`;
          body_text = "Congratulations! Your event has sold out.";
        } else {
          title = `📈 ${event.name} is ${percent}% sold`;
          body_text = `Your event has reached ${percent}% capacity. Great progress!`;
        }
        break;

      case "event_reminder":
        categorySlug = "organizer_event_reminder";
        const hours = data?.hoursUntil || 24;
        title = `⏰ ${event.name} starts in ${hours} hours`;
        body_text = `Your event is coming up soon. Make sure everything is ready!`;
        ctaUrl = `/events/${eventId}`;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid notification type" },
          { status: 400 }
        );
    }

    // Create the notification
    const result = await createNotification({
      recipientId: event.organizer_id,
      roleScope: role as "admin" | "super_admin" | "lister" | "public_user",
      categorySlug,
      title,
      body: body_text,
      metadata: {
        eventId,
        eventName: event.name,
        type,
        ...data,
      },
      priority:
        type === "milestone" && (data?.milestonePercent || 0) >= 100
          ? "high"
          : "normal",
      ctaLabel: "View Dashboard",
      ctaUrl,
      dedupeKey:
        type === "milestone"
          ? `organizer_milestone_${eventId}_${data?.milestonePercent}`
          : undefined,
    });

    return NextResponse.json({
      success: true,
      notificationId: result.notification.id,
    });
  } catch (error) {
    console.error("Organizer notification error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send notification",
      },
      { status: 500 }
    );
  }
}
