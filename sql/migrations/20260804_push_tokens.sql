-- Expo push tokens: one row per registered device, so a push notification
-- can fan out to every device a user is signed into. Feeds the `push`
-- channel already modeled in notification_channels/notification_outbox.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
  ON public.push_tokens (user_id);
