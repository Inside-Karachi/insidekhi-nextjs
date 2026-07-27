-- Admin override for the "Hidden Gems" listings feature.
-- Separate from the trending_* and top_rated_* columns so a listing can be
-- curated independently in each feed. Additive, defaulted columns - zero
-- behavior change until an admin uses them. Run against Postgres before
-- deploying the matching app code.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS hidden_gem_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_gem_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_gem_pinned_at timestamptz NULL;

COMMENT ON COLUMN public.listings.hidden_gem_pinned IS 'Admin override: force this listing into the "Hidden Gems" list regardless of its computed discovery score.';
COMMENT ON COLUMN public.listings.hidden_gem_hidden IS 'Admin override: force this listing out of the "Hidden Gems" list regardless of its computed discovery score. Takes precedence over hidden_gem_pinned.';
COMMENT ON COLUMN public.listings.hidden_gem_pinned_at IS 'Set to now() when hidden_gem_pinned is turned on, cleared to NULL when turned off. Orders multiple pinned listings most-recent-first.';
