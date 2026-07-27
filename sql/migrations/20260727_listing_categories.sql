-- Multi-category listings: join table + backfill from listings.category_id
-- Keeps listings.category_id as the primary category for backward compatibility.

CREATE TABLE IF NOT EXISTS public.listing_categories (
  listing_id bigint NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_categories_category_id
  ON public.listing_categories (category_id);

CREATE INDEX IF NOT EXISTS idx_listing_categories_listing_id
  ON public.listing_categories (listing_id);

-- At most one primary category per listing
CREATE UNIQUE INDEX IF NOT EXISTS listing_categories_one_primary_per_listing
  ON public.listing_categories (listing_id)
  WHERE is_primary = true;

-- Backfill from existing primary FK
INSERT INTO public.listing_categories (listing_id, category_id, is_primary)
SELECT id, category_id, true
FROM public.listings
WHERE category_id IS NOT NULL
ON CONFLICT (listing_id, category_id) DO UPDATE
  SET is_primary = EXCLUDED.is_primary;

COMMENT ON TABLE public.listing_categories IS
  'Many-to-many listing ↔ category. listings.category_id remains the primary category.';
