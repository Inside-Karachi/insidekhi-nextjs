-- Listing capacity / per-person pricing fields + limited data_entry role
-- Run against Postgres before deploying the matching app code.

-- 1. Extend user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'data_entry';

-- 2. Capacity / pricing columns on listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS min_price_per_person numeric(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS max_price_per_person numeric(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS min_guest_capacity integer NULL,
  ADD COLUMN IF NOT EXISTS max_guest_capacity integer NULL;

-- 3. CHECK constraints (idempotent via drop/add)
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_min_price_per_person_nonneg,
  DROP CONSTRAINT IF EXISTS listings_max_price_per_person_nonneg,
  DROP CONSTRAINT IF EXISTS listings_price_per_person_order,
  DROP CONSTRAINT IF EXISTS listings_min_guest_capacity_positive,
  DROP CONSTRAINT IF EXISTS listings_max_guest_capacity_positive,
  DROP CONSTRAINT IF EXISTS listings_guest_capacity_order;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_min_price_per_person_nonneg
    CHECK (min_price_per_person IS NULL OR min_price_per_person >= 0),
  ADD CONSTRAINT listings_max_price_per_person_nonneg
    CHECK (max_price_per_person IS NULL OR max_price_per_person >= 0),
  ADD CONSTRAINT listings_price_per_person_order
    CHECK (
      min_price_per_person IS NULL
      OR max_price_per_person IS NULL
      OR min_price_per_person <= max_price_per_person
    ),
  ADD CONSTRAINT listings_min_guest_capacity_positive
    CHECK (min_guest_capacity IS NULL OR min_guest_capacity >= 1),
  ADD CONSTRAINT listings_max_guest_capacity_positive
    CHECK (max_guest_capacity IS NULL OR max_guest_capacity >= 1),
  ADD CONSTRAINT listings_guest_capacity_order
    CHECK (
      min_guest_capacity IS NULL
      OR max_guest_capacity IS NULL
      OR min_guest_capacity <= max_guest_capacity
    );

COMMENT ON COLUMN public.listings.min_price_per_person IS 'Minimum price per person (PKR)';
COMMENT ON COLUMN public.listings.max_price_per_person IS 'Maximum price per person (PKR)';
COMMENT ON COLUMN public.listings.min_guest_capacity IS 'Minimum guest capacity';
COMMENT ON COLUMN public.listings.max_guest_capacity IS 'Maximum guest capacity';
