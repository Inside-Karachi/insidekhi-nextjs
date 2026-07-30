-- Raw event log for recommendation personalization ("habits"). Deliberately
-- not analytics_events (uuid entity_id vs. bigint listings, enum event_type/
-- source needing an irreversible ALTER TYPE ADD VALUE with no mobile source
-- value, different retention/PII posture) and not points_log/awardXP (cooldowns
-- and max_per_day deliberately drop repeat signals, the opposite of what
-- affinity needs, and related_id has no entity-type discriminator).

CREATE TABLE IF NOT EXISTS public.user_listing_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid   NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anon_id    text   NULL,
  listing_id bigint NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  event_type text   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  context    jsonb  NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ule_actor_present CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL),
  CONSTRAINT ule_type CHECK (event_type IN (
    'view','view_long','favorite','unfavorite','contact_click','call_click',
    'directions_click','menu_open','share','rec_impression','rec_click'))
);

CREATE INDEX IF NOT EXISTS ule_user_created_idx
  ON public.user_listing_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ule_anon_created_idx
  ON public.user_listing_events (anon_id, created_at DESC) WHERE anon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ule_listing_created_idx
  ON public.user_listing_events (listing_id, created_at DESC);

COMMENT ON TABLE public.user_listing_events IS
  'Raw per-actor listing interaction log driving recommendation affinity (lib/recommendations/affinity.ts). text event_type + CHECK, not an enum - see migration header for why.';
