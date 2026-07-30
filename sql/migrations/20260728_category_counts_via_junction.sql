-- categories_with_published_listing_count previously counted via the legacy
-- listings.category_id single FK, so listings tagged with a category only as
-- a secondary category (via listing_categories) were never counted toward
-- that category's total. Recompute via the junction table instead.
CREATE OR REPLACE VIEW categories_with_published_listing_count AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.parent_id,
  c.icon_name,
  COUNT(DISTINCT l.id) AS published_listing_count
FROM categories c
LEFT JOIN listing_categories lc ON lc.category_id = c.id
LEFT JOIN listings l ON l.id = lc.listing_id AND l.status = 'published'::listing_status
GROUP BY c.id, c.name, c.slug, c.parent_id, c.icon_name;
