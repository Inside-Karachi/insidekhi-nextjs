/**
 * Seed category_search_aliases from taxonomy peekaboo tags + common intents.
 * Idempotent upsert. Requires migration 20260728_places_search_indexes.sql.
 *
 * Usage: npx tsx scripts/seed_category_search_aliases.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { normalizeSearchText } from "../lib/utils/places-search";

type AliasRow = { alias: string; slug: string; weight: number };

const EXTRA_ALIASES: AliasRow[] = [
  { alias: "cafe", slug: "restaurants-cafes", weight: 1 },
  { alias: "cafes", slug: "restaurants-cafes", weight: 1 },
  { alias: "restaurant", slug: "restaurants-cafes", weight: 1 },
  { alias: "restaurants", slug: "restaurants-cafes", weight: 1 },
  { alias: "burger", slug: "fast-food-street-food", weight: 1 },
  { alias: "burgers", slug: "fast-food-street-food", weight: 1 },
  { alias: "dentist", slug: "dental-eye-care", weight: 1 },
  { alias: "dental", slug: "dental-eye-care", weight: 1 },
  { alias: "eye", slug: "dental-eye-care", weight: 0.9 },
  { alias: "salon", slug: "salons-spas", weight: 1 },
  { alias: "spa", slug: "salons-spas", weight: 1 },
  { alias: "gym", slug: "entertainment-recreation", weight: 1 },
  { alias: "fitness", slug: "entertainment-recreation", weight: 1 },
  { alias: "hospital", slug: "clinics-hospitals", weight: 1 },
  { alias: "clinic", slug: "clinics-hospitals", weight: 1 },
  { alias: "pharmacy", slug: "pharmacies-medical-stores", weight: 1 },
  { alias: "chemist", slug: "pharmacies-medical-stores", weight: 1 },
  { alias: "school", slug: "schools-pre-schools", weight: 1 },
  { alias: "university", slug: "colleges-universities-institutes", weight: 1 },
  { alias: "college", slug: "colleges-universities-institutes", weight: 1 },
];

function loadAliasesFromTaxonomyDoc(): AliasRow[] {
  const docPath = path.join(
    process.cwd(),
    "docs",
    "new-categories-and-subcategories.md",
  );
  const content = fs.readFileSync(docPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: AliasRow[] = [];

  // Parent, subcategory (may contain commas), kebab-slug, "tags..."
  const lineRe =
    /^[^,]+,(.+),([a-z0-9]+(?:-[a-z0-9]+)+),(?:"([^"]*)"|([^,]*))\s*$/;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(lineRe);
    if (!m) {
      console.warn(`Unparsed taxonomy line: ${line.slice(0, 80)}`);
      continue;
    }
    const subName = m[1].trim();
    const slug = m[2];
    const tagsRaw = (m[3] ?? m[4] ?? "").trim();
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

    for (const tag of tags) {
      const alias = normalizeSearchText(tag);
      if (alias.length < 2) continue;
      rows.push({ alias, slug, weight: 1 });
    }

    const subNorm = normalizeSearchText(subName);
    if (subNorm.length >= 2) {
      rows.push({ alias: subNorm, slug, weight: 1 });
    }
  }

  return rows;
}

async function main() {
  const rawConn = process.env.DATABASE_URL;
  if (!rawConn) {
    console.error("Error: DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: rawConn.split("?")[0],
    ssl: { rejectUnauthorized: false },
  });

  try {
    const fromDoc = loadAliasesFromTaxonomyDoc();
    const all = [...fromDoc, ...EXTRA_ALIASES];

    // Dedupe by alias; first wins (doc tags before extras)
    const byAlias = new Map<string, AliasRow>();
    for (const row of all) {
      const key = normalizeSearchText(row.alias);
      if (key.length < 2) continue;
      if (!byAlias.has(key)) {
        byAlias.set(key, { ...row, alias: key });
      }
    }

    const slugs = [...new Set([...byAlias.values()].map((r) => r.slug))];
    const { rows: cats } = await pool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM categories WHERE slug = ANY($1::text[])`,
      [slugs],
    );
    const slugToId = new Map(cats.map((c) => [c.slug, Number(c.id)]));

    let upserted = 0;
    let skipped = 0;

    for (const row of byAlias.values()) {
      const categoryId = slugToId.get(row.slug);
      if (!categoryId) {
        skipped += 1;
        console.warn(`Skip alias "${row.alias}" — missing slug ${row.slug}`);
        continue;
      }

      await pool.query(
        `INSERT INTO category_search_aliases (alias, category_id, weight)
         VALUES ($1, $2, $3)
         ON CONFLICT (alias) DO UPDATE
           SET category_id = EXCLUDED.category_id,
               weight = EXCLUDED.weight`,
        [row.alias, categoryId, row.weight],
      );
      upserted += 1;
    }

    console.log(`Upserted ${upserted} aliases (${skipped} skipped).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
