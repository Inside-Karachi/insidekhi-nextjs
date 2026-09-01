import { query } from "@/lib/db";
import type {
  ResumableBookingDTO,
  ResumeBlockReason,
} from "@/types/checkout-resume.types";

export type { ResumableBookingDTO, ResumeBlockReason };

/**
 * Shared logic for discovering and re-arming a resumable booking, used by both
 * the website (`/api/checkout/resumable`) and the mobile API
 * (`/api/mobile/v1/checkout/resumable`) so the two can never drift apart.
 *
 * The problem this solves: a payment that fails or is abandoned leaves a real
 * booking row on the server, but both clients threw their cart away, so the
 * user had to re-pick every ticket and re-type every guest's details. Here the
 * server is the memory - the clients store nothing.
 */

/**
 * How long after creation we still OFFER to resume a booking.
 *
 * Deliberately keyed on `created_at`, NOT `expires_at`. Those are two different
 * clocks and conflating them deadlocks the feature: a mobile booking's
 * `expires_at` is only 15 minutes, and both `resume-payment` and
 * `payments/token` used to 410 once it lapsed - so a user coming back at minute
 * 20 could neither resume nor pay, while being told to "resume it before
 * paying". `expires_at` is the *payment hold*; this is the *resume window*.
 */
export const RESUME_WINDOW_MINUTES = 45;

/** How long a re-armed booking is held for payment. Re-applied on every resume. */
export const PAYMENT_HOLD_MINUTES = 30;

/** Payment states a booking can be resumed FROM. */
const RESUMABLE_PAYMENT_STATUSES = ["awaiting_payment", "pending", "failed"] as const;

export type ResumeLookupResult =
  | { booking: ResumableBookingDTO; blocked?: undefined }
  | { booking: null; blocked: ResumeBlockReason }
  | { booking: null; blocked?: undefined };

type BookingRow = {
  id: string | number;
  booking_reference: string | null;
  total_amount: string | number;
  payment_status: string | null;
  status: string | null;
  customer_name: string | null;
  cnic_last4: string | null;
  event_id: string | number | null;
  created_at: string;
  expires_at: string | null;
  event_name: string;
  event_slug: string;
  event_status: string;
  event_start_time: string;
  event_end_time: string;
  location_name: string | null;
};

type ItemRow = {
  ticket_type_id: string | number;
  quantity: number;
  price_per_ticket: string | number;
  ticket_name: string;
  quantity_available: number | null;
  sale_ends_at: string;
};

const num = (v: unknown): number => Number(v ?? 0) || 0;

/**
 * Why a booking cannot be resumed, or null when it can.
 *
 * Note the ordering: terminal money states are checked before the time window,
 * so an already-paid booking says "already paid" rather than "expired".
 */
export function assertResumable(
  row: Pick<BookingRow, "payment_status" | "status" | "created_at" | "event_status" | "event_end_time">,
  now: Date = new Date(),
): ResumeBlockReason | null {
  const paymentStatus = (row.payment_status ?? "").toLowerCase();

  if (paymentStatus === "paid") return "already_paid";
  if (paymentStatus === "refunded") return "refunded";
  if (paymentStatus === "expired") return "expired_status";
  if ((row.status ?? "").toLowerCase() === "cancelled") return "cancelled";

  const createdAt = Date.parse(row.created_at);
  if (
    Number.isNaN(createdAt) ||
    now.getTime() - createdAt > RESUME_WINDOW_MINUTES * 60_000
  ) {
    return "window_lapsed";
  }

  if (row.event_status !== "published") return "event_unpublished";
  const eventEnd = Date.parse(row.event_end_time);
  if (!Number.isNaN(eventEnd) && eventEnd <= now.getTime()) return "event_unpublished";

  return null;
}

function buildPreview(
  row: BookingRow,
  items: ItemRow[],
  opts: { checkInventory: boolean },
  now: Date = new Date(),
): ResumableBookingDTO {
  const subtotal = items.reduce(
    (sum, i) => sum + num(i.price_per_ticket) * num(i.quantity),
    0,
  );
  const totalAmount = num(row.total_amount);

  const createdAt = Date.parse(row.created_at);
  const resumeExpiresAt = new Date(createdAt + RESUME_WINDOW_MINUTES * 60_000);
  const secondsRemaining = Math.max(
    0,
    Math.floor((resumeExpiresAt.getTime() - now.getTime()) / 1000),
  );

  let availability: ResumableBookingDTO["availability"] = "ok";
  if (items.some((i) => Date.parse(i.sale_ends_at) <= now.getTime())) {
    availability = "sale_closed";
  } else if (
    // Only meaningful for bookings that never reserved stock - see
    // `fetchResumableBooking`'s `checkInventory` note.
    opts.checkInventory &&
    items.some(
      (i) => i.quantity_available != null && i.quantity_available < num(i.quantity),
    )
  ) {
    availability = "sold_out";
  }

  return {
    booking_id: Number(row.id),
    booking_reference: row.booking_reference,
    payment_status: (row.payment_status ?? "").toLowerCase(),
    currency: "PKR",
    subtotal,
    // Clamped at 0: a total below the line sum would otherwise render as a
    // negative "fee", which is worse than showing none.
    fees: Math.max(0, totalAmount - subtotal),
    total_amount: totalAmount,
    created_at: row.created_at,
    expires_at: row.expires_at,
    resume_expires_at: resumeExpiresAt.toISOString(),
    seconds_remaining: secondsRemaining,
    event: {
      id: Number(row.event_id),
      name: row.event_name,
      slug: row.event_slug,
      start_time: row.event_start_time,
      location_name: row.location_name,
    },
    items: items.map((i) => ({
      ticket_type_id: Number(i.ticket_type_id),
      ticket_name: i.ticket_name,
      quantity: num(i.quantity),
      price_per_ticket: num(i.price_per_ticket),
      line_total: num(i.price_per_ticket) * num(i.quantity),
    })),
    buyer: { name: row.customer_name, cnic_last4: row.cnic_last4 },
    availability,
  };
}

/**
 * The caller's most recent resumable booking, as a redacted preview.
 *
 * `checkInventory` exists because the two platforms reserve stock differently:
 * the mobile RPC (`create_booking_with_reservation`) decrements
 * `ticket_types.quantity_available` at booking creation and nothing ever
 * restores it, so re-checking availability would block a mobile user against
 * their *own* reservation. The website's `create_booking_atomic` never
 * reserves, so resuming there is a genuine claim on live stock and must be
 * checked. Pass `false` from mobile, `true` from web.
 */
export async function fetchResumableBooking(
  userId: string,
  opts: {
    eventIds?: number[];
    bookingReference?: string;
    bookingId?: number;
    checkInventory: boolean;
  },
): Promise<ResumeLookupResult> {
  const conditions: string[] = ["b.user_id = $1"];
  const params: unknown[] = [userId];

  // A targeted lookup (from the failure screen) must still resolve a booking
  // that is outside the window or already terminal, so the caller can show the
  // right message instead of a bare "nothing found". Only the untargeted
  // discovery query pre-filters on state and recency.
  const targeted = Boolean(opts.bookingReference || opts.bookingId);

  if (opts.bookingReference) {
    params.push(opts.bookingReference);
    conditions.push(`b.booking_reference = $${params.length}`);
  } else if (opts.bookingId) {
    params.push(opts.bookingId);
    conditions.push(`b.id = $${params.length}`);
  } else {
    params.push(RESUMABLE_PAYMENT_STATUSES as unknown as string[]);
    conditions.push(`b.payment_status::text = ANY($${params.length}::text[])`);
    conditions.push(`b.status::text <> 'cancelled'`);
    conditions.push(
      `b.created_at > now() - interval '${RESUME_WINDOW_MINUTES} minutes'`,
    );
    if (opts.eventIds?.length) {
      params.push(opts.eventIds);
      conditions.push(`b.event_id = ANY($${params.length}::bigint[])`);
    }
  }

  // Sequential awaits, never Promise.all: the production pool is capped at
  // max:1 connection per serverless instance (lib/db.ts), so concurrent
  // queries only queue against a 10s acquisition timeout.
  const { rows } = await query(
    `SELECT b.id, b.booking_reference, b.total_amount, b.payment_status::text AS payment_status,
            b.status::text AS status, b.customer_name, b.cnic_last4, b.event_id,
            to_json(b.created_at) #>> '{}' AS created_at,
            to_json(b.expires_at) #>> '{}' AS expires_at,
            e.name AS event_name, e.slug AS event_slug, e.status::text AS event_status,
            to_json(e.start_time) #>> '{}' AS event_start_time,
            to_json(e.end_time)   #>> '{}' AS event_end_time,
            e.location_name
       FROM bookings b
       JOIN events e ON e.id = b.event_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY b.created_at DESC
      LIMIT 1`,
    params,
  );

  const row = rows[0] as BookingRow | undefined;
  if (!row) return { booking: null };

  const blocked = assertResumable(row);
  if (blocked) return { booking: null, blocked };

  const { rows: itemRows } = await query(
    `SELECT bi.ticket_type_id, bi.quantity, bi.price_per_ticket,
            tt.name AS ticket_name, tt.quantity_available,
            to_json(tt.sale_ends_at) #>> '{}' AS sale_ends_at
       FROM booking_items bi
       JOIN ticket_types tt ON tt.id = bi.ticket_type_id
      WHERE bi.booking_id = $1
      ORDER BY bi.ticket_type_id`,
    [row.id],
  );

  // A booking with no lines can't be previewed or meaningfully re-paid.
  if (itemRows.length === 0) return { booking: null };

  const preview = buildPreview(row, itemRows as ItemRow[], {
    checkInventory: opts.checkInventory,
  });

  // Targeted lookups skip the pre-filter above, so apply the state checks here.
  if (targeted) {
    const targetedBlock = assertResumable(row);
    if (targetedBlock) return { booking: null, blocked: targetedBlock };
  }

  if (preview.availability === "sale_closed") {
    return { booking: null, blocked: "sale_closed" };
  }

  return { booking: preview };
}

/**
 * Re-arms a booking for another payment attempt: extends the hold and returns
 * it to `awaiting_payment`.
 *
 * Retries are ALWAYS routed through here, even when the booking is already
 * `awaiting_payment`, so that the only transition into `paid` is from
 * `awaiting_payment` - the one path already exercised in production by the
 * PayFast callback.
 *
 * Safe against `trg_payment_status_transition`, which (verified against the
 * live database) blocks only transitions out of `paid` and out of `refunded`.
 * Both are rejected before this is called.
 */
export async function rearmBooking(bookingId: number): Promise<string> {
  const newExpiry = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000);
  await query(
    `UPDATE bookings
        SET expires_at = $2, payment_status = 'awaiting_payment'
      WHERE id = $1`,
    [bookingId, newExpiry.toISOString()],
  );
  return newExpiry.toISOString();
}

/** User-facing copy for a block reason. Shared so web and mobile match. */
export function resumeBlockMessage(reason: ResumeBlockReason): string {
  switch (reason) {
    case "already_paid":
      return "This booking has already been paid.";
    case "refunded":
      return "This booking was refunded.";
    case "cancelled":
      return "This booking was cancelled.";
    case "expired_status":
    case "window_lapsed":
      return "This booking has expired. Please pick your tickets again.";
    case "sale_closed":
      return "Ticket sales for this event have closed.";
    case "sold_out":
      return "These tickets are no longer available.";
    case "event_unpublished":
      return "This event is no longer available.";
  }
}
