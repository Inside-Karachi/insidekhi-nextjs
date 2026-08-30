-- New notification category for the "someone found your review helpful"
-- notification. Deliberately bell-only / non-mandatory so repeat helpful
-- votes on the same review stay low-key (the app code dedupes on
-- `review-helpful-<reviewId>` and refreshes one running notification rather
-- than inserting a new row per vote).
--
-- The reply ("business replied to your review") and status
-- (approved/removed) notifications reuse the pre-existing
-- `public_comment_outcome` and `public_review_outcome` categories, which
-- were already seeded for this purpose but had no call sites wired up yet.

INSERT INTO public.notification_categories
  (slug, label, audience_roles, is_mandatory, default_channel_config)
VALUES
  (
    'public_review_helpful',
    'Review helpful votes',
    ARRAY['public_user']::public.user_role[],
    false,
    '{"bell": true, "email": false, "push": false}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;
