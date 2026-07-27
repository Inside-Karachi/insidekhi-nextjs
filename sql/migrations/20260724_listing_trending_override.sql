-- Admin override for the "Trending Spots This Week" listings feature.
-- Additive, defaulted columns — zero behavior change until an admin uses them.
-- Run against Postgres before deploying the matching app code.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS trending_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trending_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trending_pinned_at timestamptz NULL;

COMMENT ON COLUMN public.listings.trending_pinned IS 'Admin override: force this listing into the trending list regardless of its computed score.';
COMMENT ON COLUMN public.listings.trending_hidden IS 'Admin override: force this listing out of the trending list regardless of its computed score. Takes precedence over trending_pinned.';
COMMENT ON COLUMN public.listings.trending_pinned_at IS 'Set to now() when trending_pinned is turned on, cleared to NULL when turned off. Orders multiple pinned listings most-recent-first.';
