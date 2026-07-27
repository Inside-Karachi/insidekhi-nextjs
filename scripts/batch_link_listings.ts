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
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length >= 5) {
      results.push({
        id: cols[0],
        name: cols[1],
        primary_pair_id: cols[2],
        primary_category: cols[3],
        primary_subcategory: cols[4],
      });
    }
  }
  return results;
}

async function main() {
  const customCsvArg = process.argv[2];
  const targetCsvPath = customCsvArg
    ? path.resolve(customCsvArg)
    : path.join(process.cwd(), "exports", "classified_listings_1001_to_2000.csv");

  console.log(`Loading target CSV file: ${targetCsvPath}`);
  if (!fs.existsSync(targetCsvPath)) {
    console.error(`Error: CSV file not found at ${targetCsvPath}`);
    process.exit(1);
  }

  const rawConn = process.env.DATABASE_URL || "";
  const connStr = rawConn.split("?")[0];

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
    console.log("Fetching DB subcategory mappings...");
    const { rows: subcatRows } = await pool.query(`
      SELECT 
        c.id AS subcat_id, 
        c.name AS subcat_name, 
        p.name AS parent_name
      FROM categories c
      JOIN categories p ON c.parent_id = p.id
    `);

    const lookupMap = new Map<string, number>();
    for (const row of subcatRows) {
      const nameKey = `${row.parent_name.trim().toLowerCase()} -> ${row.subcat_name.trim().toLowerCase()}`;
      lookupMap.set(nameKey, row.subcat_id);
    }

    const targetRows = loadClassifiedCsv(targetCsvPath);
    console.log(`Preparing bulk update for ${targetRows.length} listings...`);

    const updateTuples: [number, number][] = [];
    let unmapped = 0;

    for (const row of targetRows) {
      const listingId = Number(row.id);
      const parentName = row.primary_category.trim();
      const subcatName = row.primary_subcategory.trim();
      const lookupKey = `${parentName.toLowerCase()} -> ${subcatName.toLowerCase()}`;
      const targetSubcatId = lookupMap.get(lookupKey);

      if (targetSubcatId && !isNaN(listingId)) {
        updateTuples.push([listingId, targetSubcatId]);
      } else {
        unmapped++;
      }
    }

    console.log(`Found ${updateTuples.length} valid tuples to update in bulk.`);

    if (updateTuples.length === 0) {
      console.log("No valid tuples found to update.");
      process.exit(0);
    }

    const valuePlaceholders = updateTuples
      .map((_, idx) => `($${idx * 2 + 1}::int, $${idx * 2 + 2}::int)`)
      .join(", ");

    const queryParams: number[] = [];
    for (const tuple of updateTuples) {
      queryParams.push(tuple[0], tuple[1]);
    }

    const bulkSql = `
      UPDATE listings 
      SET category_id = v.cat_id 
      FROM (VALUES ${valuePlaceholders}) AS v(listing_id, cat_id) 
      WHERE listings.id = v.listing_id
    `;

    console.log("Executing bulk SQL update query...");
    const result = await pool.query(bulkSql, queryParams);

    console.log(`\nBULK UPDATE COMPLETE! Updated ${result.rowCount} listings in PostgreSQL (Unmapped: ${unmapped}).`);

    // Verify sample from DB
    const sampleIds = updateTuples.slice(0, 10).map(t => t[0]);
    const { rows: verifyRows } = await pool.query(
      `SELECT l.id, l.name, l.category_id, c.name AS subcategory, p.name AS parent_category 
       FROM listings l
       LEFT JOIN categories c ON l.category_id = c.id
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE l.id = ANY($1::int[])`,
      [sampleIds]
    );

    console.log("\nVerification sample from DB (first 10 of this batch):");
    console.table(verifyRows);

  } catch (err) {
    console.error("Bulk update failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
