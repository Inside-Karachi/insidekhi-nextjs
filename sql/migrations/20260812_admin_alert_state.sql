-- Workstream 2, step 3: admin incident tracking with open/resolved
-- lifecycle so a persisting condition does not re-notify admins every
-- single night. Evaluated nightly by
-- app/api/cron/evaluate-admin-alerts/route.ts via lib/alerts/evaluators.ts.
--
-- No separate notification-category migration accompanies this one: admin
-- notifications already resolve their category dynamically per-recipient
-- via resolveCategorySlugForRole() (lib/notifications/service.ts), falling
-- back to the existing 'general' category when no role-targeted category
-- exists - the same pattern already used to notify admins/listers of a
-- pending review reply in app/api/business/reviews/reply/route.ts. See the
-- Workstream 2 report for what this investigation found in
-- notification_categories.

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id            bigserial PRIMARY KEY,
  -- 'merchant_dashboard_inactive' | 'payment_failure_spike' | 'venue_rating_drop'
  alert_type    text NOT NULL,
  -- De-dup/identity key within alert_type: a user_id (merchant inactivity),
  -- 'global' (payment failure spike - one site-wide incident), or a
  -- listing_id (venue rating drop), always stored as text.
  subject_key   text NOT NULL,
  status        text NOT NULL DEFAULT 'open',
  severity      text NOT NULL DEFAULT 'warning',
  title         text NOT NULL,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz NULL,

  CONSTRAINT admin_alerts_status_chk CHECK (status IN ('open', 'resolved'))
);

-- Only one OPEN incident per (alert_type, subject_key) at a time. A
-- resolved incident that recurs later creates a fresh row (and therefore a
-- fresh notification) rather than silently reopening the old one.
CREATE UNIQUE INDEX IF NOT EXISTS admin_alerts_open_unique_idx
  ON public.admin_alerts (alert_type, subject_key)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS admin_alerts_type_status_idx
  ON public.admin_alerts (alert_type, status);

COMMENT ON TABLE public.admin_alerts IS
  'Nightly-evaluated admin incidents (merchant dashboard inactivity, payment/booking failure rate spikes, venue rating drops) with open/resolved state, auto-closed once the underlying condition clears. See lib/alerts/evaluators.ts and lib/scoring/thresholds.ts.';
