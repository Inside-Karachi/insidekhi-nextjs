import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

type ClassifiedCsvRow = {
  id: string;
  name: string;
  primary_pair_id: string;
  primary_category: string;
  primary_subcategory: string;
  primary_relevance_score: string;
  flagged: string;
  secondary_pairs: string;
  all_pair_scores_json: string;
  reasoning: string;
};

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

function loadClassifiedCsv(csvPath: string): ClassifiedCsvRow[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const results: ClassifiedCsvRow[] = [];
  const header = parseCsvLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length >= 5) {
      results.push({
        id: cols[0],
        name: cols[1],
        primary_pair_id: cols[2],
        primary_category: cols[3],
        primary_subcategory: cols[4],
        primary_relevance_score: cols[5] || "0.0",
        flagged: cols[6] || "false",
        secondary_pairs: cols[7] || "",
        all_pair_scores_json: cols[8] || "{}",
        reasoning: cols[9] || "",
      });
    }
  }
  return results;
}

async function main() {
  const limitArg = process.argv.includes("--limit")
    ? Number(process.argv[process.argv.indexOf("--limit") + 1])
    : 100;

  console.log(`Running category linking for the first ${limitArg} listings...`);

  const rawConn = process.env.DATABASE_URL || "";
  const connStr = rawConn.split("?")[0];

  // Fallback to IP if domain resolution is restricted
  const pool = new Pool({
    connectionString: connStr,
    host: "68.183.226.253",
    port: 25060,
    user: "doadmin",
    password: "AVNS_36sNS9NiJatAr7w9iLX",
    database: "defaultdb",
    ssl: { rejectUnauthorized: false },
  });

  try {
    // 1. Fetch DB subcategories mapping
    const { rows: subcatRows } = await pool.query(`
      SELECT 
        c.id AS subcat_id, 
        c.name AS subcat_name, 
        c.slug AS subcat_slug, 
        p.id AS parent_id,
        p.name AS parent_name, 
        p.slug AS parent_slug
      FROM categories c
      JOIN categories p ON c.parent_id = p.id
    `);

    // Build lookup keys (by exact name and normalized slug)
    const lookupMap = new Map<string, number>();
    for (const row of subcatRows) {
      const nameKey = `${row.parent_name.trim().toLowerCase()} -> ${row.subcat_name.trim().toLowerCase()}`;
      lookupMap.set(nameKey, row.subcat_id);
    }

    console.log(`Loaded ${subcatRows.length} subcategory mappings from database.`);

    // 2. Load Classified CSV
    const csvPath = path.join(process.cwd(), "exports", "classified_first_1000_listings.csv");
    const allRows = loadClassifiedCsv(csvPath);
    const targetRows = allRows.slice(0, limitArg);

    console.log(`Processing ${targetRows.length} rows from ${csvPath}...`);

    const updateResults = [];
    let updatedCount = 0;
    let unmappedCount = 0;

    for (const row of targetRows) {
      const listingId = Number(row.id);
      const parentName = row.primary_category.trim();
      const subcatName = row.primary_subcategory.trim();

      const lookupKey = `${parentName.toLowerCase()} -> ${subcatName.toLowerCase()}`;
      const targetSubcatId = lookupMap.get(lookupKey);

      if (!targetSubcatId) {
        console.warn(`[WARNING] No DB category ID found for: '${parentName} -> ${subcatName}' (Listing ID ${listingId})`);
        unmappedCount++;
        continue;
      }

      // Get current listing state
      const { rows: curRows } = await pool.query(
        `SELECT id, name, category_id FROM listings WHERE id = $1`,
        [listingId]
      );

      if (curRows.length === 0) {
        console.warn(`[WARNING] Listing ID ${listingId} not found in DB!`);
        continue;
      }

      const oldCatId = curRows[0].category_id;

      // Execute UPDATE
      await pool.query(
        `UPDATE listings SET category_id = $1 WHERE id = $2`,
        [targetSubcatId, listingId]
      );

      updatedCount++;
      updateResults.push({
        id: listingId,
        name: curRows[0].name,
        old_category_id: oldCatId,
        new_category_id: targetSubcatId,
        parent_category: parentName,
        subcategory: subcatName,
      });
    }

    console.log(`\nSuccessfully updated ${updatedCount} listings in PostgreSQL (Unmapped/Skipped: ${unmappedCount})!\n`);
    console.table(updateResults.slice(0, 20));

    // Summary Stats
    console.log(`\nPreview summary of updated sample (showing first 20 of ${updatedCount}):`);

  } catch (err) {
    console.error("Error during listing category update:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
