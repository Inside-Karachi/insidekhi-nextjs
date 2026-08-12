-- General mobile event log (screen views, search behavior, source_context).
-- Deliberately not analytics_events (enum event_type/source, cookie-auth
-- pipeline) and not user_listing_events (requires non-null listing_id,
-- event_type CHECK scoped to listing-affinity actions) — see
-- 20260729_user_listing_events.sql for the same reasoning applied once
-- already. event_name/platform are plain text with no enum/CHECK, unlike
-- analytics_events, to avoid that table's irreversible ALTER TYPE problem.

CREATE TABLE IF NOT EXISTS public.mobile_events (
  id             bigserial PRIMARY KEY,
  event_name     text        NOT NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  user_id        uuid        NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anon_id        text        NULL,
  session_id     text        NOT NULL,
  source_context text        NOT NULL,
  screen         text        NULL,
  platform       text        NULL,
  app_version    text        NULL,
  os_version     text        NULL,
  context        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT me_actor_present CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS me_event_occurred_idx ON public.mobile_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS me_user_occurred_idx  ON public.mobile_events (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS me_anon_occurred_idx   ON public.mobile_events (anon_id, occurred_at DESC) WHERE anon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS me_session_idx         ON public.mobile_events (session_id, occurred_at DESC);

COMMENT ON TABLE public.mobile_events IS
  'General mobile product-analytics event log (screen views, search). text event_name + no enum - see migration header for why. Context keys for search_performed match analytics_events convention (query/resultCount/hasResults) for future cross-platform aggregation.';
