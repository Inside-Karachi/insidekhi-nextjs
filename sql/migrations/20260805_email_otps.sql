-- One-time-code email verification for signup. Separate from auth.users'
-- confirmation_token (a uuid meant for tappable links) because a 6-digit
-- code needs attempt-tracking to resist guessing, which a bare token column
-- has no room for.

CREATE TABLE IF NOT EXISTS public.email_otps (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  purpose    text NOT NULL DEFAULT 'signup',
  attempts   int  NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_otps_purpose CHECK (purpose IN ('signup'))
);

CREATE INDEX IF NOT EXISTS email_otps_user_id_idx ON public.email_otps(user_id);
