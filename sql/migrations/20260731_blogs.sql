-- Blog feature: moderation trail on `posts`, blog category taxonomy, and a
-- self-serve "become a writer" application flow. Mirrors the existing
-- listings draft -> pending_approval -> published/rejected workflow.

-- 1. Extend post_status with the same review states listings already use.
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. Moderation trail on posts, matching listings' review columns.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS review_notes text;

-- 3. Blog category/tag taxonomy (separate from the business-listing `categories` table).
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Post <-> category join, same shape as listing_categories.
CREATE TABLE IF NOT EXISTS public.blog_post_categories (
  post_id bigint NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES public.blog_categories(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_categories_category_id
  ON public.blog_post_categories (category_id);

CREATE INDEX IF NOT EXISTS idx_blog_post_categories_post_id
  ON public.blog_post_categories (post_id);

CREATE UNIQUE INDEX IF NOT EXISTS blog_post_categories_one_primary_per_post
  ON public.blog_post_categories (post_id)
  WHERE is_primary = true;

-- 5. Self-serve "become a writer" applications.
CREATE TABLE IF NOT EXISTS public.writer_applications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  portfolio_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writer_applications_user_id
  ON public.writer_applications (user_id);

-- Only one pending application per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS writer_applications_one_pending_per_user
  ON public.writer_applications (user_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.blog_categories IS
  'Blog category/tag taxonomy, independent of the business-listing categories table.';
COMMENT ON TABLE public.blog_post_categories IS
  'Many-to-many post <-> blog_category, mirrors listing_categories.';
COMMENT ON TABLE public.writer_applications IS
  'Self-serve applications from users requesting the writer role; admin-approved.';
