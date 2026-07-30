-- Seed Fitness & Sports parent category and 28 new subcategories
-- Safe/idempotent via ON CONFLICT (slug) DO NOTHING

-- 1. Create Parent Category: Fitness & Sports
INSERT INTO public.categories (name, slug, parent_id, icon_name)
VALUES ('Fitness & Sports', 'fitness-sports', NULL, 'Dumbbell')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- 2. Insert subcategories under Food & Dining (75)
INSERT INTO public.categories (name, slug, parent_id, icon_name) VALUES
  ('Cafes & Coworking Spots', 'cafes-coworking-spots', 75, 'Coffee'),
  ('Fine Dining & Buffets', 'fine-dining-buffets', 75, 'Utensils'),
  ('Catering & Home-Based Cooks', 'catering-home-based-cooks', 75, 'ChefHat'),
  ('Juice Bars & Beverages', 'juice-bars-beverages', 75, 'CupSoda')
ON CONFLICT (slug) DO NOTHING;

-- 3. Insert subcategories under Shopping & Fashion (76)
INSERT INTO public.categories (name, slug, parent_id, icon_name) VALUES
  ('Kids & Baby Products', 'kids-baby-products', 76, 'Baby'),
  ('Second-Hand & Thrift', 'second-hand-thrift', 76, 'Shirt'),
  ('Sports & Outdoor Gear', 'sports-outdoor-gear', 76, 'Trophy'),
  ('Gift Shops & Novelties', 'gift-shops-novelties', 76, 'Gift')
ON CONFLICT (slug) DO NOTHING;

-- 4. Insert subcategories under Health & Wellness (77)
INSERT INTO public.categories (name, slug, parent_id, icon_name) VALUES
  ('Diagnostic Labs & Imaging', 'diagnostic-labs-imaging', 77, 'Activity'),
  ('Mental Health & Therapy', 'mental-health-therapy', 77, 'HeartHandshake'),
  ('Physiotherapy & Rehab', 'physiotherapy-rehab', 77, 'Heart'),
  ('Nutritionists & Dieticians', 'nutritionists-dieticians', 77, 'Apple')
ON CONFLICT (slug) DO NOTHING;

-- 5. Insert subcategories under Beauty & Personal Care (78)
INSERT INTO public.categories (name, slug, parent_id, icon_name) VALUES
  ('Barbershops & Men''s Grooming', 'barbershops-mens-grooming', 78, 'Scissors'),
  ('Nail Studios', 'nail-studios', 78, 'Sparkles'),
  ('Tattoo & Piercing Studios', 'tattoo-piercing-studios', 78, 'Palette')
ON CONFLICT (slug) DO NOTHING;

-- 6. Insert subcategories under Services & Living (79)
INSERT INTO public.categories (name, slug, parent_id, icon_name) VALUES
  ('Home Services & Repairs', 'home-services-repairs', 79, 'Wrench'),
  ('Event Planning & Catering Services', 'event-planning-catering', 79, 'Calendar'),
  ('Cleaning & Maintenance', 'cleaning-maintenance', 79, 'Sparkles'),
  ('Legal & Financial Services', 'legal-financial-services', 79, 'Scale'),
  ('IT & Tech Support', 'it-tech-support', 79, 'Laptop'),
  ('Pet Care & Veterinary', 'pet-care-veterinary', 79, 'Dog'),
  ('Printing & Photography Studios', 'printing-photography-studios', 79, 'Camera')
ON CONFLICT (slug) DO NOTHING;

-- 7. Insert subcategories under Education & Learning (80)
INSERT INTO public.categories (name, slug, parent_id, icon_name) VALUES
  ('Tutoring & Coaching Centers', 'tutoring-coaching-centers', 80, 'GraduationCap'),
  ('Skill & Vocational Training', 'skill-vocational-training', 80, 'BookOpen'),
  ('Language Learning Centers', 'language-learning-centers', 80, 'Languages'),
  ('Test Prep (SAT/IELTS/etc.)', 'test-prep', 80, 'FileText')
ON CONFLICT (slug) DO NOTHING;

-- 8. Insert subcategories under Fitness & Sports (Parent: slug fitness-sports)
INSERT INTO public.categories (name, slug, parent_id, icon_name)
SELECT sub.name, sub.slug, parent.id, sub.icon_name
FROM (VALUES
  ('Gyms & Fitness Centers', 'gyms-fitness-centers', 'Dumbbell'),
  ('Padel, Cricket & Futsal Clubs', 'padel-cricket-futsal-clubs', 'Trophy'),
  ('Swimming Pools & Clubs', 'swimming-pools-clubs', 'Waves'),
  ('Yoga & Martial Arts Studios', 'yoga-martial-arts-studios', 'Heart')
) AS sub(name, slug, icon_name)
CROSS JOIN (
  SELECT id FROM public.categories WHERE slug = 'fitness-sports' LIMIT 1
) AS parent
ON CONFLICT (slug) DO NOTHING;

-- 9. Insert subcategories under Entertainment & Recreation (99)
INSERT INTO public.categories (name, slug, parent_id, icon_name) VALUES
  ('Cinemas & Amusement Parks', 'cinemas-amusement-parks', 99, 'Film'),
  ('Parks & Outdoor Spaces', 'parks-outdoor-spaces', 99, 'Trees'),
  ('Gaming Lounges & Arcades', 'gaming-lounges-arcades', 99, 'Gamepad2'),
  ('Live Music & Comedy Venues', 'live-music-comedy-venues', 99, 'Music')
ON CONFLICT (slug) DO NOTHING;

-- Sync sequence max value
SELECT setval('public.categories_id_seq', (SELECT MAX(id) FROM public.categories));
