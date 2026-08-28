-- User-submitted reports on reviews and comments (spam/harassment/etc).
-- One row per (reporter, content) pair - the unique constraint is the
-- duplicate-prevention mechanism, mirroring how `helpful_reviews` prevents a
-- user voting twice on the same review.

CREATE TABLE IF NOT EXISTS public.content_reports (
  id bigserial PRIMARY KEY,
  content_type text NOT NULL CHECK (content_type IN ('review', 'comment')),
  content_id bigint NOT NULL,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL,
  details text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by uuid NULL REFERENCES public.profiles(id),
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_lookup
  ON public.content_reports (content_type, content_id, status);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports (status, created_at DESC);
