---
name: Listing Category Backfill
overview: Read-only DB export to CSV; map Peekaboo tags to parent→subcategory in the CSV only; report all unmatched listings and tags separately. Zero database writes — nothing in Postgres is created, updated, or deleted.
todos:
  - id: write-findings-md
    content: Write docs/listing-categorization-backfill.md with findings, parent→subcategory taxonomy, and full tag→subcategory map
    status: completed
  - id: export-listings-csv
    content: READ-ONLY export of listings + current categories into CSV (SELECT only; no INSERT/UPDATE/DELETE)
    status: completed
  - id: apply-map-to-csv
    content: Apply tag→subcategory map in CSV only — proposed_* columns; database untouched
    status: completed
  - id: report-unmatched
    content: Deliver unmatched report to user — unmatched listings CSV + unmatched tags frequency list (also CSV-only)
    status: completed
isProject: false
---

# Categorize Uncategorized Listings (CSV-first)

## Hard guarantee

**Nothing in the database will be impacted.** Only `SELECT` reads. No `INSERT` / `UPDATE` / `DELETE`. All categorization work happens in CSV files on disk.

## Goal (this phase)

1. Work with **parent categories → subcategories** (leaf `category_id` only).
2. Match **top uncategorized Peekaboo tags** into those **subcategories**.
3. **Export listings → CSV**, apply proposed category/subcategory **in the CSV only**.
4. **Tell you every unmatched listing and every unmatched tag** (separate report files + console summary).

## Findings

| Metric | Count | Share |
|---|---:|---:|
| Total listings | 15,823 | 100% |
| Categorized | 5,156 | 32.6% |
| Uncategorized (`category_id` IS NULL) | 10,667 | 67.4% |

- All uncategorized are Peekaboo + `archived`.
- 6,415 have `peekaboo_tags`; 4,252 have empty tags.
- Root cause: Peekaboo tag strings ≠ InsideKHI subcategory names (e.g. `Women's Wear` vs `Clothing & Fashion Stores`).

## Taxonomy (parents → subcategories)

Use existing enabled leaf categories under these parents:

- **Eat & Drink** → Bakeries & Desserts, BBQ, Breakfast, Cafés, Chinese, Coffee Shops, Continental, Fast Food, Fine Dining, Juice Bars & Ice Cream, Pakistani, Seafood, Street Food, Vegetarian/Vegan, …
- **Shopping** → Malls, Local Markets, Clothing & Fashion Stores, Electronics & Gadgets, Home & Decor Stores, Bookstores & Stationery, Jewelry & Accessories, Supermarkets & Grocery, …
- **Hospitals** → Hospitals & Clinics, Pharmacies, Dental Care, Beauty & Skincare Clinics, Gyms & Fitness, Yoga & Wellness, Mental Health, Alternative Medicine
- **Where to Stay** → Hotels, Guest Houses, Serviced Apartments, Short Term Rentals, Resorts & Beach Huts
- **Entertainment / Things to Do / Education / Guides & Reviews** — as needed for rarer tags
- Top-level leaves also used when appropriate: **Salons**, **Gyms**

Listings store a single `category_id` pointing at the **subcategory (leaf)**. Parent is derived via `categories.parent_id`.

## Proposed Peekaboo tag → subcategory map

| Peekaboo tag (approx count) | Parent | Subcategory (slug) |
|---|---|---|
| Phones (1220) | Shopping | Electronics & Gadgets (`electronics-gadgets`) |
| Women's Wear (868) | Shopping | Clothing & Fashion Stores (`clothing-fashion-stores`) |
| Pharmacy (794) | Hospitals | Pharmacies (`pharmacies`) |
| Men's Wear (511) | Shopping | Clothing & Fashion Stores |
| Footwear (309) | Shopping | Clothing & Fashion Stores |
| Bakery (306) | Eat & Drink | Bakeries & Desserts (`bakeries-desserts`) |
| Kid's Wear (255) | Shopping | Clothing & Fashion Stores |
| Pizza (235) | Eat & Drink | Fast Food (`fast-food`) |
| Biryani (234) | Eat & Drink | Pakistani (`pakistani`) |
| Burgers (216) | Eat & Drink | Fast Food |
| Optics / Eye Wear (~180) | Shopping | Jewelry & Accessories (`jewelry-accessories`) |
| Home Appliances (165) | Shopping | Electronics & Gadgets |
| Tea (140) | Eat & Drink | Cafés (`cafes`) |
| TVs & Electronics (133) | Shopping | Electronics & Gadgets |
| Fragrances (114) | Shopping | Jewelry & Accessories |
| Makeup (101) | Hospitals | Beauty & Skincare Clinics (`beauty-skincare-clinics`) |
| Beverages (96) | Eat & Drink | Juice Bars & Ice Cream (`juice-bars-ice-cream-parlors`) |
| Home Decor / Furniture (~90) | Shopping | Home & Decor Stores (`home-decor-stores`) |
| Fries / Sandwiches / Snacks | Eat & Drink | Fast Food |
| Watches / Bags | Shopping | Jewelry & Accessories |
| Play Area / Swimming Pool / Farmhouse | Entertainment / Things to Do | nearest leaf (e.g. Outdoor Entertainment / Adventure) |
| Cakes / Sweets / Nimco | Eat & Drink | Bakeries & Desserts |
| Beauty Parlours | — | Salons (`salons`) |
| Book Shop | Shopping | Bookstores & Stationery (`bookstores-stationery-shops`) |
| Labs | Hospitals | Hospitals & Clinics (`hospitals-clinics`) |
| Baby Shop | Shopping | Clothing & Fashion Stores |
| Computers | Shopping | Electronics & Gadgets |
| E-Store / Order-Now | — | leave unmatched (channel tags, not venue type) |
| Shakes / Chaat | Eat & Drink | Juice Bars / Street Food |

Empty-tag rows: leave proposed category blank in this CSV phase (name/desc rules later).

## CSV workflow (no DB writes)

```mermaid
flowchart LR
  db[(listings DB read-only)] --> export[Export CSV]
  export --> map[Apply tag to subcategory map]
  map --> out[listings-categorized.csv]
  out --> review[Human review]
```

### Export columns

Path: [`exports/listings-with-categories.csv`](exports/listings-with-categories.csv) (or similar under repo `exports/`, gitignored if large).

Include at least:

- `id`, `name`, `slug`, `status`, `peekaboo_id`
- `peekaboo_tags` (joined tag names)
- **Current:** `category_id`, `category_name`, `parent_category_name`
- **Proposed (filled by script):** `proposed_category_id`, `proposed_subcategory`, `proposed_parent`, `matched_tag`, `match_method` (`tag_map` | `existing` | `unmatched`)

Rules:

- If listing already has `category_id`: copy into proposed columns; `match_method=existing`.
- If uncategorized and a peekaboo tag hits the map: set proposed leaf subcategory + parent; `match_method=tag_map`.
- Else: proposed fields empty; `match_method=unmatched` — **these are reported to you explicitly** (not silently dropped).
- **Never** mutate the database in this phase.

### Unmatched reporting (required)

You will get unmatched called out clearly:

1. **`exports/listings-unmatched.csv`** — every listing that stayed unmatched (no proposed subcategory), with `id`, `name`, `status`, `peekaboo_tags`, reason (`no_tags` | `tags_not_in_map`).
2. **`exports/unmatched-tags.csv`** — each unmatched Peekaboo tag + how many uncategorized listings carry it (so you can decide new subcategory mappings).
3. Console summary: matched count, unmatched count, empty-tag count, top unmatched tags.

Matched + unmatched rows also remain in the main CSV (`match_method` column) so you can filter either way.

### Deliverables on execution

1. [`docs/listing-categorization-backfill.md`](docs/listing-categorization-backfill.md) — findings + full map + how to re-run export.
2. [`exports/listings-with-categories.csv`](exports/listings-with-categories.csv) — full export with current + proposed columns.
3. [`exports/listings-unmatched.csv`](exports/listings-unmatched.csv) + [`exports/unmatched-tags.csv`](exports/unmatched-tags.csv).
4. Console match/unmatch summary.
5. Script uses **read-only** DB access only.

## Explicitly out of scope (this phase)

- Any write to Postgres (including `category_id`)
- Changing `status` / publishing archived listings
- Wiring `CategoryMapper` for live scraper
- LLM categorization

## Later (only if you ask)

A separate, explicit follow-up can import approved `proposed_category_id` into the DB. That will **not** happen in this phase.
