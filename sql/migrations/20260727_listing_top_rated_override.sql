-- Admin override for the "Top Rated by Insiders" listings feature.
-- Separate from the trending_* columns so a listing can be curated
-- independently in each feed. Additive, defaulted columns — zero behavior
-- change until an admin uses them. Run against Postgres before deploying
-- the matching app code.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS top_rated_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS top_rated_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS top_rated_pinned_at timestamptz NULL;

COMMENT ON COLUMN public.listings.top_rated_pinned IS 'Admin override: force this listing into the "Top Rated by Insiders" list regardless of its insider rating.';
COMMENT ON COLUMN public.listings.top_rated_hidden IS 'Admin override: force this listing out of the "Top Rated by Insiders" list regardless of its insider rating. Takes precedence over top_rated_pinned.';
COMMENT ON COLUMN public.listings.top_rated_pinned_at IS 'Set to now() when top_rated_pinned is turned on, cleared to NULL when turned off. Orders multiple pinned listings most-recent-first.';
