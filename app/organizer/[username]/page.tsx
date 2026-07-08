import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { OrganizerPublicProfile } from "@/components/organizer/OrganizerPublicProfile";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function OrganizerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const supabase = await createServerSupabase({ publicAnon: true });
  const { username } = await params;

  // Fetch organizer profile
  const { data: organizer, error: organizerError } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .eq("role", "organizer")
    .single();

  if (organizerError || !organizer) {
    notFound();
  }

  // Fetch organizer's events with stats
  const { data: eventsData } = await supabase
    .from("events_with_details")
    .select("*")
    .eq("organizer_id", organizer.id)
    .eq("event_status", "published")
    .order("start_time", { ascending: false });

  // Get all event IDs for image fetching
  const eventIds =
    eventsData
      ?.filter((row) => row.event_id)
      .map((row) => row.event_id!)
      .filter((id): id is number => id !== null) || [];

  // Fetch event images for all events
  const { data: eventImages } = await supabase
    .from("event_images")
    .select("*")
    .in("event_id", eventIds);

  // Create a map of event_id to images array
  const imagesMap = new Map<
    number,
    Array<import("@/types/events.types").EventImage>
  >();
  eventImages?.forEach((img) => {
    if (!imagesMap.has(img.event_id)) {
      imagesMap.set(img.event_id, []);
    }
    imagesMap.get(img.event_id)!.push({
      id: img.id,
      url: img.url,
      is_primary: img.is_primary || false,
      event_id: img.event_id,
      alt_text: img.alt_text || null,
      display_order: img.display_order || 0,
    });
  });

  // Map to Event type with images
  const allEvents: import("@/types/events.types").Event[] = (eventsData || [])
    .filter(
      (row) =>
        row.event_id &&
        row.event_name &&
        row.event_slug &&
        row.start_time &&
        row.end_time &&
        row.event_status &&
        row.organizer_id,
    )
    .map((row) => ({
      id: row.event_id!,
      name: row.event_name!,
      slug: row.event_slug!,
      description: row.event_description,
      start_time: row.start_time!,
      end_time: row.end_time!,
      status: row.event_status!,
      organizer_id: row.organizer_id!,
      organizer_name: row.organizer_name,
      organizer_avatar: row.organizer_avatar,
      location_name: row.location_name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      images: imagesMap.get(row.event_id!) || [],
    }));

  // Calculate stats
  const now = new Date();

  const upcomingEvents = allEvents.filter((e) => new Date(e.start_time) > now);
  const pastEvents = allEvents.filter((e) => new Date(e.end_time) < now);
  const ongoingEvents = allEvents.filter(
    (e) => new Date(e.start_time) <= now && new Date(e.end_time) >= now,
  );

  // Get attendees count (sum of all ticket quantities)
  const { data: ticketData } = await supabase
    .from("booking_items")
    .select("quantity")
    .in(
      "booking_id",
      (
        await supabase
          .from("bookings")
          .select("id")
          .eq("organizer_id", organizer.id)
          .eq("status", "completed")
      ).data?.map((b) => b.id) || [],
    );

  const totalAttendees =
    ticketData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <OrganizerPublicProfile
      organizer={organizer}
      events={allEvents}
      upcomingEvents={upcomingEvents}
      pastEvents={pastEvents}
      ongoingEvents={ongoingEvents}
      totalAttendees={totalAttendees}
    />
  );
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  // Use createClient at build time (no cookies needed for public data)
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { username } = await params;

  const { data: organizer } = await supabase
    .from("profiles")
    .select("full_name, organizer_bio")
    .eq("username", username)
    .eq("role", "organizer")
    .single();

  if (!organizer) {
    return {
      title: "Organizer Not Found",
    };
  }

  return {
    title: `${organizer.full_name} - Event Organizer | Inside Karachi`,
    description:
      organizer.organizer_bio?.substring(0, 160) ||
      `View ${organizer.full_name}'s profile and upcoming events on Inside Karachi`,
  };
}
