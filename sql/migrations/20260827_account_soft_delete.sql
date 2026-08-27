-- Account soft-delete / anonymization support.
-- Adds a durable "this account was self-deleted" marker on profiles, and a
-- single atomic function that anonymizes a profile + auth.users row while
-- leaving all of the user's reviews/comments/listings/bookings untouched
-- (they only ever join profiles live by user_id, never denormalize the
-- author's name, so anonymizing profiles cascades everywhere for free).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.anonymize_and_delete_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_already_deleted timestamptz;
  v_anon_suffix text := replace(p_user_id::text, '-', '');
  v_anon_username text := 'deleted_' || substr(v_anon_suffix, 1, 12);
  v_anon_email text := 'deleted+' || v_anon_suffix || '@deleted.insidekarachi.local';
BEGIN
  SELECT deleted_at INTO v_already_deleted
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_already_deleted IS NOT NULL THEN
    -- Idempotency guard: never re-run anonymization on an already-deleted
    -- row (would corrupt the already-anonymized username/email further).
    RETURN jsonb_build_object('success', false, 'error', 'already_deleted');
  END IF;

  UPDATE public.profiles
  SET full_name = 'Inside Karachi User',
      avatar_url = NULL,
      username = v_anon_username,
      phone = NULL,
      organizer_bio = NULL,
      organizer_company = NULL,
      organizer_website = NULL,
      deleted_at = now(),
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE auth.users
  SET email = v_anon_email,
      encrypted_password = NULL,
      raw_app_meta_data = '{}'::jsonb,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'anonymized_email', v_anon_email,
    'anonymized_username', v_anon_username
  );
END;
$$;
