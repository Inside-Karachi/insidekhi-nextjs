import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { createMobileServiceClient } from "@/lib/mobile/supabase";

export const dynamic = "force-dynamic";

// Role-aware sidebar counters. admin/super_admin -> platform totals (service-role);
// lister -> global content counts; organizer -> own events/bookings/tickets;
// everyone else -> own reviews/bookings/favorites.
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? null;

  const headCount = "*";

  if (role === "admin" || role === "super_admin") {
    const admin = createMobileServiceClient();
    const [{ count: users }, { count: events }, { count: listings }] =
      await Promise.all([
        admin
          .from("profiles")
          .select(headCount, { count: "exact", head: true }),
        admin.from("events").select(headCount, { count: "exact", head: true }),
        admin
          .from("listings")
          .select(headCount, { count: "exact", head: true }),
      ]);
    return ok({
      role,
      stats: {
        users: users ?? 0,
        events: events ?? 0,
        listings: listings ?? 0,
      },
    });
  }

  if (role === "lister") {
    const [{ count: listings }, { count: events }, { count: reviews }] =
      await Promise.all([
        supabase
          .from("listings")
          .select(headCount, { count: "exact", head: true }),
        supabase
          .from("events")
          .select(headCount, { count: "exact", head: true }),
        supabase
          .from("reviews")
          .select(headCount, { count: "exact", head: true }),
      ]);
    return ok({
      role,
      stats: {
        listings: listings ?? 0,
        events: events ?? 0,
        reviews: reviews ?? 0,
      },
    });
  }

  if (role === "organizer") {
    const [{ count: events }, { count: bookings }, { count: tickets }] =
      await Promise.all([
        supabase
          .from("events")
          .select(headCount, { count: "exact", head: true })
          .eq("organizer_id", user.id),
        supabase
          .from("bookings")
          .select(headCount, { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("ticket_passes")
          .select("*, booking:bookings!inner(user_id)", {
            count: "exact",
            head: true,
          })
          .eq("bookings.user_id", user.id),
      ]);
    return ok({
      role,
      stats: {
        events: events ?? 0,
        bookings: bookings ?? 0,
        tickets: tickets ?? 0,
      },
    });
  }

  const [{ count: reviews }, { count: bookings }, { count: favorites }] =
    await Promise.all([
      supabase
        .from("reviews")
        .select(headCount, { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("bookings")
        .select(headCount, { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("favorite_listings")
        .select(headCount, { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
  return ok({
    role: role ?? "user",
    stats: {
      reviews: reviews ?? 0,
      bookings: bookings ?? 0,
      favorites: favorites ?? 0,
    },
  });
});
