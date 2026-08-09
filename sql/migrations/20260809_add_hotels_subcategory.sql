-- Seed Hotels & Accommodations subcategory under Services & Living (79)
INSERT INTO public.categories (name, slug, parent_id, icon_name)
VALUES ('Hotels & Accommodations', 'hotels-accommodations', 79, 'Hotel')
ON CONFLICT (slug) DO NOTHING;

-- Sync sequence
SELECT setval('public.categories_id_seq', (SELECT MAX(id) FROM public.categories));
