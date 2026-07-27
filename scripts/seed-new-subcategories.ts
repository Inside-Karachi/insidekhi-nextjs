import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

type SubcategoryDef = {
  parentName: string;
  parentSlug: string;
  name: string;
  slug: string;
  displayOrder: number;
};

const PARENT_SLUGS = [
  "food-dining",
  "shopping-fashion",
  "health-wellness",
  "beauty-personal-care",
  "services-living",
  "education-learning",
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function loadSubcategoriesFromCsv(): SubcategoryDef[] {
  const csvPath = path.join(process.cwd(), "exports", "new-categories-subcategories.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const results: SubcategoryDef[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length >= 5) {
      results.push({
        parentName: cols[0],
        parentSlug: cols[1],
        name: cols[2],
        slug: cols[3],
        displayOrder: Number(cols[4]) || i,
      });
    }
  }
  return results;
}

async function main() {
  const rawConn = process.env.DATABASE_URL;
  if (!rawConn) {
    console.error("Error: DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

  const connStr = rawConn.split("?")[0];
  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Connecting to PostgreSQL database...");

    const { rows: parentRows } = await pool.query(
      `SELECT id, name, slug FROM categories WHERE slug = ANY($1::text[])`,
      [PARENT_SLUGS]
    );

    const parentMap = new Map<string, number>();
    for (const p of parentRows) {
      parentMap.set(p.slug, p.id);
    }

    const subcats = loadSubcategoriesFromCsv();
    console.log(`\nFound ${subcats.length} subcategories to seed/upsert...`);

    const upsertedResults = [];

    for (const sub of subcats) {
      const parentId = parentMap.get(sub.parentSlug);
      if (!parentId) {
        console.warn(`Skipping subcategory ${sub.name}: parent ${sub.parentSlug} not found.`);
        continue;
      }

      const { rows: existingRows } = await pool.query(
        `SELECT id, name, slug, parent_id FROM categories WHERE slug = $1 LIMIT 1`,
        [sub.slug]
      );

      let record;
      if (existingRows.length > 0) {
        const { rows: updateRows } = await pool.query(
          `UPDATE categories 
           SET name = $1, parent_id = $2 
           WHERE slug = $3 
           RETURNING id, name, slug, parent_id`,
          [sub.name, parentId, sub.slug]
        );
        record = updateRows[0];
        console.log(`[UPDATED] Subcategory '${record.name}' (ID: ${record.id}) -> Parent ID: ${record.parent_id}`);
      } else {
        const { rows: insertRows } = await pool.query(
          `INSERT INTO categories (name, slug, parent_id) 
           VALUES ($1, $2, $3) 
           RETURNING id, name, slug, parent_id`,
          [sub.name, sub.slug, parentId]
        );
        record = insertRows[0];
        console.log(`[INSERTED] Subcategory '${record.name}' (ID: ${record.id}) -> Parent ID: ${record.parent_id}`);
      }

      upsertedResults.push({
        id: record.id,
        name: record.name,
        slug: record.slug,
        parent_id: record.parent_id,
        parent_slug: sub.parentSlug,
      });
    }

    console.log(`\nSuccessfully saved all ${upsertedResults.length} subcategories under the 6 parent categories!\n`);
    console.table(upsertedResults);

  } catch (err) {
    console.error("Database operation failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
