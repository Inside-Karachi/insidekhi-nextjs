-- Move Parks & Outdoor Spaces under Health & Wellness (ID 77)
UPDATE public.categories
SET parent_id = 77
WHERE slug = 'parks-outdoor-spaces';
