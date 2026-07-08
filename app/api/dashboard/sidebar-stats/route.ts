import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/sidebar-stats
 * Returns role-based statistics for the sidebar
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    // Admin or Super Admin: Get system-wide stats
    if (role === "admin" || role === "super_admin") {
      const adminSupabase = await createServerSupabase({
        useServiceRole: true,
      });

      const [
        { count: usersCount },
        { count: eventsCount },
        { count: listingsCount },
      ] = await Promise.all([
        adminSupabase
          .from("profiles")
          .select("*", { count: "exact", head: true }),
        adminSupabase
          .from("events")
          .select("*", { count: "exact", head: true }),
        adminSupabase
          .from("listings")
          .select("*", { count: "exact", head: true }),
      ]);

      return NextResponse.json({
        success: true,
        role: role,
        stats: {
          users: usersCount || 0,
          events: eventsCount || 0,
          listings: listingsCount || 0,
        },
      });
    }

    // Lister: Get content stats
    if (role === "lister") {
      const [
        { count: listingsCount },
        { count: eventsCount },
        { count: reviewsCount },
      ] = await Promise.all([
        supabase.from("listings").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("reviews").select("*", { count: "exact", head: true }),
      ]);

      return NextResponse.json({
        success: true,
        role: role,
        stats: {
          listings: listingsCount || 0,
          events: eventsCount || 0,
          reviews: reviewsCount || 0,
        },
      });
    }

    // Organizer: Get organizer-specific stats
    if (role === "organizer") {
      const [
        { count: eventsCount },
        { count: bookingsCount },
        { count: ticketsCount },
      ] = await Promise.all([
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", user.id),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("ticket_passes")
          .select("*, booking:bookings!inner(user_id)", {
            count: "exact",
            head: true,
          })
          .eq("bookings.user_id", user.id),
      ]);

      return NextResponse.json({
        success: true,
        role: role,
        stats: {
          events: eventsCount || 0,
          bookings: bookingsCount || 0,
          tickets: ticketsCount || 0,
        },
      });
    }

    // Regular User: Get personal stats
    const [
      { count: reviewsCount },
      { count: bookingsCount },
      { count: favoritesCount },
    ] = await Promise.all([
      supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("favorite_listings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    return NextResponse.json({
      success: true,
      role: role || "user",
      stats: {
        reviews: reviewsCount || 0,
        bookings: bookingsCount || 0,
        favorites: favoritesCount || 0,
      },
    });
  } catch (error) {
    console.error("Sidebar stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sidebar stats" },
      { status: 500 },
    );
  }
}
