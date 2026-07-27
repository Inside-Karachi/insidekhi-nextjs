# Listing Categorization Backfill (CSV-first)

## Hard guarantee

This phase **does not write to the database**. Only `SELECT` reads are used. Proposed categories are written to CSV files under `exports/`.

## Findings (as of export date)

| Metric | Count | Share |
|---|---:|---:|
| Total listings | 15,823 | 100% |
| Categorized (existing) | 5,156 | 32.6% |
| Uncategorized (`category_id` IS NULL) | 10,667 | 67.4% |
| Proposed via tag map (CSV only) | 5,913 | 55.4% of uncategorized |
| Still unmatched in CSV | 4,754 | 44.6% of uncategorized |

Unmatched breakdown from last export:

- `no_tags`: 4,252
- `tags_not_in_map`: 502

- All uncategorized rows are Peekaboo imports with status `archived`.
- Root cause: Peekaboo tag strings do not match InsideKHI subcategory names (e.g. `Women's Wear` ≠ `Clothing & Fashion Stores`).

## Taxonomy

Listings store a single `category_id` pointing at a **leaf subcategory**. Parent is derived from `categories.parent_id`.

Parents used in the tag map:

- **Eat & Drink** — bakeries, fast food, Pakistani, cafés, juice bars, street food, …
- **Shopping** — clothing, electronics, jewelry/accessories, home decor, bookstores, …
- **Hospitals** — pharmacies, hospitals & clinics, beauty & skincare clinics
- **Entertainment / Things to Do** — outdoor entertainment, adventure
- **Salons** — top-level leaf for beauty parlours

## Peekaboo tag → subcategory map

See source of truth: [`scrapers/peekaboo_listings/transformers/peekaboo-tag-category-map.ts`](../scrapers/peekaboo_listings/transformers/peekaboo-tag-category-map.ts)

| Peekaboo tag | Parent | Subcategory slug |
|---|---|---|
| Women's / Men's / Kid's Wear, Footwear, Baby Shop | Shopping | `clothing-fashion-stores` |
| Phones, Home Appliances, TVs & Electronics, Computers | Shopping | `electronics-gadgets` |
| Optics, Eye Wear, Watches, Bags, Fragrances | Shopping | `jewelry-accessories` |
| Home Decor, Furniture | Shopping | `home-decor-stores` |
| Book Shop | Shopping | `bookstores-stationery-shops` |
| Pharmacy | Hospitals | `pharmacies` |
| Labs | Hospitals | `hospitals-clinics` |
| Makeup | Hospitals | `beauty-skincare-clinics` |
| Bakery, Cakes, Sweets, Nimco | Eat & Drink | `bakeries-desserts` |
| Pizza, Burgers, Fries, Sandwiches, Snacks | Eat & Drink | `fast-food` |
| Biryani | Eat & Drink | `pakistani` |
| Tea | Eat & Drink | `cafes` |
| Beverages, Shakes | Eat & Drink | `juice-bars-ice-cream-parlors` |
| Chaat | Eat & Drink | `street-food` |
| Beauty Parlours | — | `salons` |
| Play Area, Swimming Pool | Entertainment | `outdoor-entertainment` |
| Farmhouse | Things to Do | `adventure-outdoor-activities` |

Intentionally unmatched (channel tags, not venue type): `E-Store`, `Order-Now`.

## How to re-run (read-only)

```bash
# from insidekhi-nextjs root (loads .env DATABASE_URL)
npx tsx scripts/export-listing-categories-csv.ts
```

Outputs:

| File | Contents |
|---|---|
| `exports/listings-with-categories.csv` | All listings + current + proposed columns |
| `exports/listings-unmatched.csv` | Listings with no proposed subcategory |
| `exports/unmatched-tags.csv` | Unmatched Peekaboo tags + frequencies |

### CSV columns (main file)

- `id`, `name`, `slug`, `status`, `peekaboo_id`, `peekaboo_tags`
- Current: `category_id`, `category_name`, `parent_category_name`
- Proposed: `proposed_category_id`, `proposed_subcategory`, `proposed_parent`, `matched_tag`, `match_method` (`existing` \| `tag_map` \| `unmatched`)

Unmatched reason in `listings-unmatched.csv`: `no_tags` \| `tags_not_in_map`.

## Later (only if explicitly requested)

Import approved `proposed_category_id` values into Postgres, and/or wire the same map into `CategoryMapper` for future scrapes. That is **not** part of this CSV phase.
