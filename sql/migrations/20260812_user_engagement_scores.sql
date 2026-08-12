-- Workstream 2, step 1: per-user engagement score + lifecycle stage,
-- refreshed nightly by app/api/cron/refresh-user-scores/route.ts via
-- lib/scoring/userEngagement.ts. Scoped to consumer accounts only
-- (profiles.role = 'public_user' - see CONSUMER_ROLES in
-- lib/scoring/thresholds.ts); business_owner/organizer/writer/staff roles
-- are out of scope here. Business-owner "merchant dashboard" activity is
-- tracked separately (see segment_membership.merchant_dashboard_inactive_21d
-- in 20260812_segment_membership.sql), not in this table.
--
-- last_engagement_at / engagement_count_30d unify three previously-separate
-- activity pipelines that don't overlap today: analytics_events (web),
-- user_listing_events (web listing interactions), mobile_events (mobile
-- app) - see the UNION ALL in lib/scoring/userEngagement.ts. This table is
-- the first place a user's activity is unified across web and mobile.
--
-- All thresholds (day cutoffs, score weights, frequency caps) live in
-- lib/scoring/thresholds.ts, not in this DDL - only the resulting row shape
-- and its constraints are defined here.

CREATE TABLE IF NOT EXISTS public.user_engagement_scores (
  user_id                   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Login recency/frequency, derived from audit_logs (action = 'user_login').
  last_login_at             timestamptz NULL,
  login_count_30d           integer NOT NULL DEFAULT 0,

  -- Booking recency/frequency/monetary value, derived from bookings.
  last_booking_at           timestamptz NULL,
  booking_count_90d         integer NOT NULL DEFAULT 0,
  total_bookings            integer NOT NULL DEFAULT 0,
  total_booking_spend       numeric(12, 2) NOT NULL DEFAULT 0,

  -- Unified web + mobile engagement recency/frequency (see header).
  last_engagement_at        timestamptz NULL,
  engagement_count_30d      integer NOT NULL DEFAULT 0,

  -- Derived summary columns.
  last_activity_at          timestamptz NOT NULL,
  days_since_last_activity  integer NOT NULL,
  lifecycle_stage           text NOT NULL,
  engagement_score          numeric(5, 2) NOT NULL,

  computed_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ues_lifecycle_stage_chk CHECK (
    lifecycle_stage IN ('new', 'active', 'at_risk', 'dormant', 'churned')
  ),
  CONSTRAINT ues_engagement_score_chk CHECK (
    engagement_score >= 0 AND engagement_score <= 100
  )
);

CREATE INDEX IF NOT EXISTS ues_lifecycle_stage_idx
  ON public.user_engagement_scores (lifecycle_stage);
CREATE INDEX IF NOT EXISTS ues_last_activity_idx
  ON public.user_engagement_scores (last_activity_at DESC);

COMMENT ON TABLE public.user_engagement_scores IS
  'Nightly-refreshed per-consumer-user engagement score (0-100) and lifecycle stage. See lib/scoring/userEngagement.ts (computation) and lib/scoring/thresholds.ts (tunable constants).';
