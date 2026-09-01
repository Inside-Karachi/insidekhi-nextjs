/**
 * Shared shapes for the resume-failed-payment flow.
 *
 * Lives here, not in `lib/checkout/resume.ts`, because that module imports
 * `lib/db` (and therefore `pg`) - client components need these types without
 * dragging a database driver toward the browser bundle.
 */

export type ResumeBlockReason =
  | "already_paid"
  | "refunded"
  | "cancelled"
  | "expired_status"
  | "window_lapsed"
  | "sale_closed"
  | "sold_out"
  | "event_unpublished";

export type ResumableBookingItem = {
  ticket_type_id: number;
  ticket_name: string;
  quantity: number;
  price_per_ticket: number;
  line_total: number;
};

export type ResumableBookingDTO = {
  booking_id: number;
  booking_reference: string | null;
  payment_status: string;
  currency: "PKR";
  /** Sum of the item lines. */
  subtotal: number;
  /**
   * `total_amount - subtotal`, DERIVED - never recomputed from a fee config.
   * `bookings.total_amount` was frozen at creation and is what the gateway
   * charges, so a client that recalculates fees locally will display a number
   * the user is not charged.
   */
  fees: number;
  /** Authoritative. What PayFast will charge. */
  total_amount: number;
  created_at: string;
  expires_at: string | null;
  resume_expires_at: string;
  seconds_remaining: number;
  event: {
    id: number;
    name: string;
    slug: string;
    start_time: string;
    location_name: string | null;
  };
  items: ResumableBookingItem[];
  /**
   * PII allow-list. `customer_email`, `customer_phone`, `cnic_hash`,
   * `verification_seed`, `basket_id` and `user_id` are deliberately absent.
   */
  buyer: { name: string | null; cnic_last4: string | null };
  availability: "ok" | "sold_out" | "sale_closed";
};

export type ResumableResponse = {
  booking: ResumableBookingDTO | null;
  blocked_reason?: ResumeBlockReason | null;
  message?: string | null;
  resume_window_minutes?: number;
};
