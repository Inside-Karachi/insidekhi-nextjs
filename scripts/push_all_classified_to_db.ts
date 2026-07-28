import "dotenv/config";
import fs from "fs";
import path from "path";
import { query } from "../lib/db";

type ClassifiedRow = {
  id: number;
  name: string;
  primaryCategory: string;
  primarySubcategory: string;
  secondaryPairs: string;
};

// Robust CSV parser handling multi-line quoted fields and commas inside quotes
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

async function main() {
  console.log("=== Pushing Classified CSV Data into PostgreSQL Database ===");

  // 1. Load category mappings from database
  const { rows: subcatRows } = await query(`
    SELECT 
      c.id AS subcat_id, 
      c.name AS subcat_name, 
      p.name AS parent_name
    FROM categories c
    JOIN categories p ON c.parent_id = p.id
  `);

  const fullPairMap = new Map<string, number>();
  const subcatOnlyMap = new Map<string, number>();

  for (const row of subcatRows) {
    const subcatId = parseInt(row.subcat_id, 10);
    const parentName = String(row.parent_name).trim().toLowerCase();
    const subcatName = String(row.subcat_name).trim().toLowerCase();

    const fullKey = `${parentName} -> ${subcatName}`;
    fullPairMap.set(fullKey, subcatId);

    if (!subcatOnlyMap.has(subcatName)) {
      subcatOnlyMap.set(subcatName, subcatId);
    }
  }

  console.log(`Loaded ${fullPairMap.size} category pairs from database.`);

  // 2. Discover all classified CSV files in exports/
  const exportsDir = path.join(process.cwd(), "exports");
  const files = fs
    .readdirSync(exportsDir)
    .filter((f) => f.startsWith("classified_") && f.endsWith(".csv"))
    .sort();

  console.log(`Found ${files.length} classified CSV files to process:`);
  files.forEach((f) => console.log(` - ${f}`));

  const allClassifiedRows = new Map<number, ClassifiedRow>();

  for (const file of files) {
    const filePath = path.join(exportsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = parseCsv(content);

    if (parsed.length <= 1) continue;

    const header = parsed[0].map((h) => h.toLowerCase());
    const idIdx = header.indexOf("id");
    const nameIdx = header.indexOf("name");
    const primCatIdx = header.indexOf("primary_category");
    const primSubcatIdx = header.indexOf("primary_subcategory");
    const secPairsIdx = header.indexOf("secondary_pairs");

    if (idIdx === -1 || primSubcatIdx === -1) {
      console.warn(`Skipping ${file}: Missing id or primary_subcategory column`);
      continue;
    }

    let fileCount = 0;
    for (let i = 1; i < parsed.length; i++) {
      const row = parsed[i];
      const listingId = parseInt(row[idIdx], 10);
      if (isNaN(listingId)) continue;

      const name = nameIdx !== -1 ? row[nameIdx] || "" : "";
      const primaryCategory = primCatIdx !== -1 ? row[primCatIdx] || "" : "";
      const primarySubcategory =
        primSubcatIdx !== -1 ? row[primSubcatIdx] || "" : "";
      const secondaryPairs = secPairsIdx !== -1 ? row[secPairsIdx] || "" : "";

      allClassifiedRows.set(listingId, {
        id: listingId,
        name,
        primaryCategory,
        primarySubcategory,
        secondaryPairs,
      });
      fileCount++;
    }
    console.log(`  Read ${fileCount} listings from ${file}`);
  }

  console.log(
    `Total unique classified listings loaded from CSVs: ${allClassifiedRows.size}`
  );

  // 3. Resolve category IDs for primary & secondary assignments
  const primaryUpdates: [number, number][] = [];
  const listingCategoryMap = new Map<
    number,
    { primaryId: number; secondaryIds: Set<number> }
  >();
  let unmappedCount = 0;

  function lookupCategoryId(parentStr: string, subcatStr: string): number | null {
    const p = parentStr.trim().toLowerCase();
    const s = subcatStr.trim().toLowerCase();

    if (p && s) {
      const fullKey = `${p} -> ${s}`;
      if (fullPairMap.has(fullKey)) return fullPairMap.get(fullKey)!;
    }
    if (s && subcatOnlyMap.has(s)) {
      return subcatOnlyMap.get(s)!;
    }
    return null;
  }

  for (const listing of allClassifiedRows.values()) {
    const primaryId = lookupCategoryId(
      listing.primaryCategory,
      listing.primarySubcategory
    );

    if (primaryId != null) {
      primaryUpdates.push([listing.id, primaryId]);

      const secIds = new Set<number>();
      if (listing.secondaryPairs && listing.secondaryPairs.trim().length > 0) {
        const pairs = listing.secondaryPairs.split(/;|\||\n/);
        for (const pair of pairs) {
          const trimmed = pair.trim();
          if (!trimmed) continue;

          let pName = "";
          let sName = trimmed;
          if (trimmed.includes("->")) {
            const parts = trimmed.split("->");
            pName = parts[0].trim();
            sName = parts[1].trim();
          }

          const secId = lookupCategoryId(pName, sName);
          if (secId != null && secId !== primaryId) {
            secIds.add(secId);
          }
        }
      }

      listingCategoryMap.set(listing.id, {
        primaryId,
        secondaryIds: secIds,
      });
    } else {
      unmappedCount++;
    }
  }

  console.log(`\nMapping Results:`);
  console.log(` - Valid primary category updates: ${primaryUpdates.length}`);
  console.log(` - Unique listings to sync in junction table: ${listingCategoryMap.size}`);
  console.log(` - Unmapped rows: ${unmappedCount}`);

  if (primaryUpdates.length === 0) {
    console.log("No valid updates to process.");
    process.exit(0);
  }

  // 4. Execute Bulk Update to listings.category_id
  console.log("\n1/2 Updating listings.category_id in bulk...");
  const BATCH_SIZE = 500;
  let totalListingsUpdated = 0;

  for (let i = 0; i < primaryUpdates.length; i += BATCH_SIZE) {
    const batch = primaryUpdates.slice(i, i + BATCH_SIZE);
    const placeholders = batch
      .map((_, idx) => `($${idx * 2 + 1}::int, $${idx * 2 + 2}::int)`)
      .join(", ");
    const params: number[] = [];
    batch.forEach(([lId, cId]) => params.push(lId, cId));

    const res = await query(
      `UPDATE listings 
       SET category_id = v.cat_id, updated_at = NOW()
       FROM (VALUES ${placeholders}) AS v(listing_id, cat_id)
       WHERE listings.id = v.listing_id`,
      params
    );
    totalListingsUpdated += res.rowCount || 0;
  }
  console.log(`Successfully updated ${totalListingsUpdated} rows in listings.category_id.`);

  // 5. Execute Sync to listing_categories join table
  console.log("\n2/2 Syncing listing_categories join table in batches...");
  const listingIdsArray = Array.from(listingCategoryMap.keys());
  let totalJunctionInserted = 0;

  for (let i = 0; i < listingIdsArray.length; i += BATCH_SIZE) {
    const batchIds = listingIdsArray.slice(i, i + BATCH_SIZE);

    // Delete existing links for this batch of listings to prevent primary key / unique index conflicts
    await query(
      `DELETE FROM listing_categories WHERE listing_id = ANY($1::bigint[])`,
      [batchIds]
    );

    const inserts: { listingId: number; categoryId: number; isPrimary: boolean }[] = [];
    for (const lId of batchIds) {
      const data = listingCategoryMap.get(lId)!;
      inserts.push({
        listingId: lId,
        categoryId: data.primaryId,
        isPrimary: true,
      });
      for (const secId of data.secondaryIds) {
        inserts.push({
          listingId: lId,
          categoryId: secId,
          isPrimary: false,
        });
      }
    }

    if (inserts.length > 0) {
      const placeholders = inserts
        .map(
          (_, idx) =>
            `($${idx * 3 + 1}::int, $${idx * 3 + 2}::int, $${idx * 3 + 3}::boolean)`
        )
        .join(", ");
      const params: unknown[] = [];
      inserts.forEach((item) =>
        params.push(item.listingId, item.categoryId, item.isPrimary)
      );

      const res = await query(
        `INSERT INTO listing_categories (listing_id, category_id, is_primary)
         VALUES ${placeholders}
         ON CONFLICT (listing_id, category_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
        params
      );
      totalJunctionInserted += res.rowCount || 0;
    }
  }

  console.log(`Successfully synced ${totalJunctionInserted} rows in listing_categories.`);

  console.log("\n=======================================================");
  console.log("DATABASE UPDATE COMPLETE!");
  console.log(` - Listings updated: ${totalListingsUpdated}`);
  console.log(` - Category links saved: ${totalJunctionInserted}`);
  console.log("=======================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing database update:", err);
  process.exit(1);
});
