-- Places search: normalize helper, lower() trigram indexes, category aliases.

CREATE OR REPLACE FUNCTION public.normalize_search_text(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(
    both ' '
    FROM regexp_replace(
      regexp_replace(lower(coalesce(t, '')), E'[''`]', '', 'g'),
      E'[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

COMMENT ON FUNCTION public.normalize_search_text(text) IS
  'Normalize listing/category text for places search (lower, strip apostrophes, collapse punct).';

-- Trigram indexes on normalized name/address (pg_trgm lives in extensions).
CREATE INDEX IF NOT EXISTS idx_listings_name_norm_trgm
  ON public.listings
  USING gin (public.normalize_search_text(name) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_address_norm_trgm
  ON public.listings
  USING gin (public.normalize_search_text(address) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_categories_name_norm_trgm
  ON public.categories
  USING gin (public.normalize_search_text(name) extensions.gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.category_search_aliases (
  alias text PRIMARY KEY,
  category_id bigint NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  weight numeric(3, 2) NOT NULL DEFAULT 1.00
);

CREATE INDEX IF NOT EXISTS idx_category_search_aliases_category_id
  ON public.category_search_aliases (category_id);

COMMENT ON TABLE public.category_search_aliases IS
  'Normalized intent/synonym tokens → category_id for Discover places search.';
