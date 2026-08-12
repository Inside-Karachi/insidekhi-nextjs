import {
  CONSUMER_ROLES,
  MERCHANT_ROLES,
  SEGMENT_SIGNUP_NO_BOOKING_MIN_DAYS,
  SEGMENT_SILENT_AFTER_ACTIVE_MIN_DAYS,
  SEGMENT_HIGH_SPENDER_CUTOFF_PKR,
  SEGMENT_MERCHANT_DASHBOARD_INACTIVE_MIN_DAYS,
} from "@/lib/scoring/thresholds";

/**
 * A segment query: a SELECT returning one `user_id uuid` column per
 * currently-qualifying user. `params` are positional and referenced from
 * `sql` as $1, $2, ... - lib/segments/refresh.ts appends the segment slug
 * as the next placeholder when it wraps this into an upsert/reconcile
 * statement, so keep `sql`'s placeholders contiguous starting at $1.
 */
export interface SegmentQuery {
  slug: string;
  sql: string;
  params: unknown[];
}

/** Segment 1: signed up 7+ days ago, still no booking. */
export const SIGNED_UP_NO_BOOKING_7D: SegmentQuery = {
  slug: "signed_up_no_booking_7d",
  sql: `
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.role::text = ANY($1::text[])
      AND p.created_at <= now() - INTERVAL '${SEGMENT_SIGNUP_NO_BOOKING_MIN_DAYS} days'
      AND NOT EXISTS (
        SELECT 1 FROM public.bookings b WHERE b.user_id = p.id
      )
  `,
  params: [CONSUMER_ROLES],
};

/**
 * Segment 2: was previously active, now 21+ days silent. "Previously
 * active" has no history table to look back on (user_engagement_scores
 * keeps only the latest snapshot), so this is approximated as "has some
 * evidence of real past activity beyond just signing up" (a recorded
 * login, booking, or web/mobile engagement event) combined with the
 * current days-since-last-activity gap.
 */
export const WAS_ACTIVE_NOW_SILENT_21D: SegmentQuery = {
  slug: "was_active_now_silent_21d",
  sql: `
    SELECT ues.user_id
    FROM public.user_engagement_scores ues
    WHERE ues.days_since_last_activity >= ${SEGMENT_SILENT_AFTER_ACTIVE_MIN_DAYS}
      AND (
        ues.last_login_at IS NOT NULL
        OR ues.last_booking_at IS NOT NULL
        OR ues.last_engagement_at IS NOT NULL
      )
  `,
  params: [],
};

/** Segment 3: total paid-booking spend above the (adjustable) high-spender cutoff. */
export const HIGH_SPENDERS: SegmentQuery = {
  slug: "high_spenders",
  sql: `
    SELECT ues.user_id
    FROM public.user_engagement_scores ues
    WHERE ues.total_booking_spend >= ${SEGMENT_HIGH_SPENDER_CUTOFF_PKR}
  `,
  params: [],
};

/**
 * Segment 4: approximates "hasn't visited the merchant dashboard in 21+
 * days" using audit_logs site-login events, since there is no
 * dashboard-specific visit tracking - the same approximation the existing
 * DAU/WAU logic in lib/analytics/admin.ts already makes for site-wide
 * activity (action = 'user_login').
 */
export const MERCHANT_DASHBOARD_INACTIVE_21D: SegmentQuery = {
  slug: "merchant_dashboard_inactive_21d",
  sql: `
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.role::text = ANY($1::text[])
      AND NOT EXISTS (
        SELECT 1 FROM public.audit_logs a
        WHERE a.user_id = p.id
          AND a.action = 'user_login'
          AND a.created_at >= now() - INTERVAL '${SEGMENT_MERCHANT_DASHBOARD_INACTIVE_MIN_DAYS} days'
      )
  `,
  params: [MERCHANT_ROLES],
};

export const ALL_SEGMENT_QUERIES: SegmentQuery[] = [
  SIGNED_UP_NO_BOOKING_7D,
  WAS_ACTIVE_NOW_SILENT_21D,
  HIGH_SPENDERS,
  MERCHANT_DASHBOARD_INACTIVE_21D,
];
