import { requireMobileUser } from "./auth";
import { MobileApiError } from "./errors";
import { query } from "@/lib/db";

/**
 * Roles allowed to use the mobile organizer surface. Mirrors `ORGANIZER_ROLES`
 * in `app/api/organizer/events/manage/route.ts` (web) — keep in sync.
 */
export const ORGANIZER_ROLES = ["organizer", "lister", "admin", "super_admin"];
const ADMIN_ROLES = ["admin", "super_admin"];

export type MobileOrganizerContext = {
  user: { id: string; email?: string; role: string };
  isAdmin: boolean;
};

/**
 * Requires a Bearer-authenticated user whose current `profiles.role` (read
 * fresh from the DB, not the JWT claim, since a role change must take effect
 * immediately) is in `ORGANIZER_ROLES`. When `eventId` is passed, additionally
 * requires the user to own that event unless they're an admin — consolidates
 * the ownership-or-admin check duplicated across the web organizer routes
 * (`app/api/organizer/events/route.ts`, `.../attendees/route.ts`,
 * `.../events/[eventId]/tickets/route.ts`, `app/api/tickets/verify/route.ts`).
 */
export async function requireMobileOrganizer(
  request: Request,
  opts?: { eventId?: number },
): Promise<MobileOrganizerContext> {
  const { user } = await requireMobileUser(request);

  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    user.id,
  ]);
  const role: string | undefined = rows[0]?.role;
  if (!role || !ORGANIZER_ROLES.includes(role)) {
    throw new MobileApiError(
      "forbidden",
      "Organizer access required.",
      403,
    );
  }
  const isAdmin = ADMIN_ROLES.includes(role);

  if (opts?.eventId !== undefined) {
    const { rows: eventRows } = await query(
      `SELECT organizer_id FROM events WHERE id = $1`,
      [opts.eventId],
    );
    const event = eventRows[0];
    if (!event) {
      throw new MobileApiError("not_found", "Event not found.", 404);
    }
    if (!isAdmin && event.organizer_id !== user.id) {
      throw new MobileApiError(
        "forbidden",
        "You do not have access to this event.",
        403,
      );
    }
  }

  return { user: { ...user, role }, isAdmin };
}
