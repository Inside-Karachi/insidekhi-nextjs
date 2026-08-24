import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import {
  enforceMobileRateLimit,
  enforceTicketVerifyRateLimit,
} from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { verifyTicketSignature } from "@/lib/tickets/signature";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1).max(64),
  eventId: z.number().int().positive().optional(),
});

/**
 * POST /api/mobile/v1/organizer/tickets/verify
 *
 * Ticket check-in for the mobile scanner. Reimplements
 * `app/api/tickets/verify/route.ts` (web) behind Bearer auth: IK- prefix
 * check, ownership-or-admin check, HMAC signature verify (shared via
 * `lib/tickets/signature.ts`), rejects revoked/unpaid tickets, atomic
 * race-safe check-in (`checked_in_at IS NULL` guard), awards XP once.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, isAdmin } = await requireMobileOrganizer(request);
  await enforceTicketVerifyRateLimit(user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A ticket code is required.",
      400,
      "code",
    );
  }
  const { code, eventId } = parsed.data;

  const normalizedCode = code.toUpperCase().trim();
  if (!normalizedCode.startsWith("IK-")) {
    throw new MobileApiError(
      "invalid_format",
      "Invalid ticket code format. Must start with IK-.",
      400,
      "code",
    );
  }

  const { rows: ticketPassRows } = await query(
    `SELECT tp.id, tp.code, tp.signature, tp.status, tp.guest_name,
            tp.checked_in_at, tp.booking_id, tp.event_id, tp.ticket_type_id,
            b.id AS booking_row_id, b.user_id AS booking_user_id,
            b.payment_status AS booking_payment_status,
            e.id AS event_row_id, e.name AS event_name, e.organizer_id AS event_organizer_id,
            tt.name AS ticket_type_name
     FROM ticket_passes tp
     INNER JOIN bookings b ON b.id = tp.booking_id
     INNER JOIN events e ON e.id = tp.event_id
     LEFT JOIN ticket_types tt ON tt.id = tp.ticket_type_id
     WHERE tp.code = $1`,
    [normalizedCode],
  );
  const ticketPass = ticketPassRows[0];
  if (!ticketPass) {
    throw new MobileApiError(
      "not_found",
      "Ticket not found. Please check the code.",
      404,
    );
  }

  const booking = {
    id: ticketPass.booking_row_id as number,
    user_id: ticketPass.booking_user_id as string,
    payment_status: ticketPass.booking_payment_status as string,
  };
  const event = {
    id: ticketPass.event_row_id as number,
    name: ticketPass.event_name as string,
    organizer_id: ticketPass.event_organizer_id as string,
  };
  const ticketType = ticketPass.ticket_type_name
    ? { name: ticketPass.ticket_type_name as string }
    : null;

  if (event.organizer_id !== user.id && !isAdmin) {
    throw new MobileApiError(
      "forbidden",
      "You are not authorized to verify tickets for this event.",
      403,
    );
  }

  if (eventId !== undefined && ticketPass.event_id !== eventId) {
    throw new MobileApiError(
      "event_mismatch",
      "Ticket does not belong to this event.",
      400,
    );
  }

  let isSignatureValid: boolean;
  try {
    isSignatureValid = verifyTicketSignature(
      ticketPass.code,
      ticketPass.event_id,
      booking.id,
      ticketPass.signature,
    );
  } catch (err) {
    console.error("[mobile-api] ticket signature check failed:", err);
    throw new MobileApiError(
      "internal_error",
      "Failed to verify ticket. Please try again.",
      500,
    );
  }
  if (!isSignatureValid) {
    console.error(
      `[FRAUD_ALERT] Invalid signature for ticket ${ticketPass.code} (mobile)`,
    );
    throw new MobileApiError(
      "invalid_signature",
      "Ticket verification failed. This may be a fraudulent ticket.",
      400,
    );
  }

  if (ticketPass.status === "revoked") {
    throw new MobileApiError(
      "revoked",
      "This ticket has been revoked.",
      400,
    );
  }

  if (
    booking.payment_status !== "paid" &&
    booking.payment_status !== "confirmed"
  ) {
    throw new MobileApiError(
      "payment_required",
      "Ticket cannot be checked in: payment has not been completed.",
      402,
    );
  }

  const alreadyCheckedIn =
    ticketPass.status === "checked_in" || !!ticketPass.checked_in_at;

  let xpAwarded = 0;

  if (!alreadyCheckedIn) {
    let updatedRows;
    try {
      ({ rows: updatedRows } = await query(
        `UPDATE ticket_passes
         SET status = 'checked_in', checked_in_at = $2
         WHERE id = $1 AND checked_in_at IS NULL
         RETURNING id`,
        [ticketPass.id, new Date().toISOString()],
      ));
    } catch (updateError) {
      console.error("[mobile-api] ticket check-in update failed:", updateError);
      throw new MobileApiError(
        "update_failed",
        "Failed to check in ticket. Please try again.",
        500,
      );
    }

    // No rows updated: a concurrent request already checked this ticket in.
    if (!updatedRows || updatedRows.length === 0) {
      return ok({
        ticket: {
          id: ticketPass.id,
          code: ticketPass.code,
          status: "checked_in",
          guestName: ticketPass.guest_name || undefined,
          ticketType: ticketType?.name || undefined,
          eventName: event.name,
          alreadyCheckedIn: true,
          checkedInAt: new Date().toISOString(),
        },
        xpAwarded: 0,
      });
    }

    // Award XP via the shared helper - matches app/api/tickets/verify/route.ts
    // (web), which used to hand-roll this insert with
    // reason: `Attended event: ${event.name}` instead of the canonical
    // "attend_event" activity_slug, breaking any eligibility/cooldown check
    // or admin dashboard aggregation keyed on that slug, and skipping
    // checkAndProcessRankUp() (a rank-up at check-in never awarded its
    // badge). awardXP() does both correctly.
    try {
      const { awardXP } = await import("@/lib/gamification");
      const xpResult = await awardXP(booking.user_id, "attend_event", ticketPass.id);
      if ("error" in xpResult) {
        console.error("[mobile-api] failed to award attend_event XP:", xpResult.error, xpResult.details);
      } else {
        xpAwarded = xpResult.xp_awarded;
      }
    } catch (xpError) {
      console.error("[mobile-api] failed to award XP:", xpError);
    }
  }

  return ok({
    ticket: {
      id: ticketPass.id,
      code: ticketPass.code,
      status: "checked_in",
      guestName: ticketPass.guest_name || undefined,
      ticketType: ticketType?.name || undefined,
      eventName: event.name,
      alreadyCheckedIn,
      checkedInAt: ticketPass.checked_in_at || new Date().toISOString(),
    },
    xpAwarded: alreadyCheckedIn ? 0 : xpAwarded,
  });
});
