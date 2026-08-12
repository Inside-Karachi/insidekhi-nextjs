-- Workstream 2, step 2: materialized segment membership (not on-demand
-- views) - the use case is "pull everyone currently in a segment and
-- message them" (a batch op), and materializing lets day-over-day
-- transitions (who newly qualified/dropped out today) be read cheaply from
-- first_qualified_at / last_confirmed_at instead of diffing two live
-- queries. Refreshed nightly by app/api/cron/refresh-segments/route.ts via
-- lib/segments/refresh.ts. See lib/segments/definitions.ts for the four
-- segment queries and lib/scoring/thresholds.ts for their tunable cutoffs.

CREATE TABLE IF NOT EXISTS public.segment_definitions (
  slug        text PRIMARY KEY,
  label       text NOT NULL,
  description text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.segment_membership (
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  segment_slug       text NOT NULL REFERENCES public.segment_definitions(slug) ON DELETE CASCADE,
  -- Preserved across refreshes (not overwritten on re-qualification) so
  -- "newly qualified today" is a cheap first_qualified_at = today check.
  first_qualified_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, segment_slug)
);

CREATE INDEX IF NOT EXISTS segment_membership_slug_idx
  ON public.segment_membership (segment_slug);

COMMENT ON TABLE public.segment_membership IS
  'Nightly-reconciled segment membership: current members are upserted, non-qualifying members are deleted, so this always reflects last night''s state. See lib/segments/refresh.ts.';

INSERT INTO public.segment_definitions (slug, label, description) VALUES
  (
    'signed_up_no_booking_7d',
    'Signed up, no booking (7d+)',
    'Consumer accounts created 7+ days ago with zero bookings to date.'
  ),
  (
    'was_active_now_silent_21d',
    'Was active, now silent (21d+)',
    'Consumer accounts with a history of real activity (a login, booking, or web/mobile engagement event) that have had none in 21+ days.'
  ),
  (
    'high_spenders',
    'High spenders',
    'Consumer accounts whose lifetime paid-booking spend is at/above the high-spender cutoff (SEGMENT_HIGH_SPENDER_CUTOFF_PKR in lib/scoring/thresholds.ts - uncalibrated, revisit with real distribution data).'
  ),
  (
    'merchant_dashboard_inactive_21d',
    'Merchant dashboard inactive (21d+)',
    'business_owner accounts with no site login (audit_logs action=user_login) in 21+ days - approximates dashboard inactivity the same way the existing DAU/WAU logic approximates site activity, since there is no dashboard-specific visit tracking.'
  )
ON CONFLICT (slug) DO NOTHING;
