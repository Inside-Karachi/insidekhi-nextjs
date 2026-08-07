-- The user's saved bank cards, for Deals & Discounts personalization ("My
-- Cards" on the mobile app, with a web equivalent to follow). Stores which
-- specific card_variants row a user carries, plus an optional nickname -
-- never anything payment-sensitive, since card_variants itself has no
-- number/CVV/expiry/PIN columns to begin with.

CREATE TABLE IF NOT EXISTS public.user_cards (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_variant_id integer NOT NULL REFERENCES public.card_variants(id) ON DELETE CASCADE,
  nickname text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id
  ON public.user_cards (user_id);

-- At most one primary card per user, enforced at the DB level (partial
-- unique index) rather than relying on application code alone, so a race
-- between two "set primary" requests can't leave two primaries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_cards_one_primary_per_user
  ON public.user_cards (user_id)
  WHERE is_primary;

COMMENT ON TABLE public.user_cards IS
  'Bank card products a user has saved for deal-matching. No payment data - card_variant_id + nickname only.';
