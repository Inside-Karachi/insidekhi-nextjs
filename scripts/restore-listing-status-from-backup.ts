#!/usr/bin/env tsx
/**
 * Restore listing `status` from a DigitalOcean Postgres backup fork.
 *
 * Use after restoring a pre-sync backup as a NEW database cluster in DO
 * (Databases → your cluster → Backups → Restore → creates a fork).
 *
 * Usage:
 *   BACKUP_DATABASE_URL="postgresql://..." DATABASE_URL="postgresql://..." \
 *     npx tsx scripts/restore-listing-status-from-backup.ts
 *
 * Options (env):
 *   DRY_RUN=true          — print counts only, no writes (default: true)
 *   APPLY=true            — actually run UPDATE (requires explicit opt-in)
 *   ONLY_PEEKABOO=true    — only rows with peekaboo_id set (default: true)
 *   ONLY_TO_PUBLISHED=true — only restore rows whose backup status is published
 */

import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const { Pool } = pg;

const backupUrl = process.env.BACKUP_DATABASE_URL?.trim();
const prodUrl = process.env.DATABASE_URL?.trim();
const dryRun = process.env.APPLY !== "true";
const onlyPeekaboo = process.env.ONLY_PEEKABOO !== "false";
const onlyToPublished = process.env.ONLY_TO_PUBLISHED === "true";

if (!backupUrl || !prodUrl) {
  console.error(
    "Set BACKUP_DATABASE_URL (restored fork) and DATABASE_URL (production).",
  );
  process.exit(1);
}

function cleanConnectionString(url: string): string {
  return url.split("?")[0];
}

function ssl(url: string) {
  return url.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined;
}

async function main() {
  const backupPool = new Pool({
    connectionString: cleanConnectionString(backupUrl),
    ssl: ssl(backupUrl),
    max: 2,
  });
  const prodPool = new Pool({
    connectionString: cleanConnectionString(prodUrl),
    ssl: ssl(prodUrl),
    max: 2,
  });

  try {
    console.log("Fetching status snapshot from backup fork...");
    const peekabooFilter = onlyPeekaboo ? "WHERE peekaboo_id IS NOT NULL" : "";
    const { rows: backupRows } = await backupPool.query<{
      id: number;
      status: string;
      peekaboo_id: number | null;
    }>(
      `SELECT id, status::text AS status, peekaboo_id
       FROM listings
       ${peekabooFilter}`,
    );

    const backupById = new Map(
      backupRows.map((r) => [r.id, r.status as string]),
    );
    console.log(`Backup rows: ${backupRows.length}`);

    const statusCounts = backupRows.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    console.log("Backup status breakdown:", statusCounts);

    const { rows: prodRows } = await prodPool.query<{
      id: number;
      status: string;
      peekaboo_id: number | null;
    }>(
      `SELECT id, status::text AS status, peekaboo_id
       FROM listings
       ${peekabooFilter}`,
    );

    const changes: Array<{
      id: number;
      from: string;
      to: string;
    }> = [];

    for (const row of prodRows) {
      const backupStatus = backupById.get(row.id);
      if (!backupStatus || backupStatus === row.status) continue;
      if (onlyToPublished && backupStatus !== "published") continue;
      changes.push({ id: row.id, from: row.status, to: backupStatus });
    }

    if (onlyToPublished) {
      console.log("Mode: ONLY_TO_PUBLISHED (skip draft/archived restores)");
    }

    const changeSummary = changes.reduce(
      (acc, c) => {
        const key = `${c.from} → ${c.to}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(`\nProduction rows checked: ${prodRows.length}`);
    console.log(`Status changes needed: ${changes.length}`);
    console.log("Change breakdown:", changeSummary);

    const toPublished = changes.filter((c) => c.to === "published").length;
    console.log(`Would restore to published: ${toPublished}`);

    if (dryRun) {
      console.log(
        "\nDRY RUN — no changes written. Re-run with APPLY=true to restore.",
      );
      return;
    }

    console.log("\nApplying updates...");
    let updated = 0;
    const batchSize = 500;

    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      const ids = batch.map((c) => c.id);
      const cases = batch
        .map((c) => `WHEN ${c.id} THEN '${c.to}'::listing_status`)
        .join(" ");

      await prodPool.query(
        `UPDATE listings
         SET status = CASE id ${cases} END,
             updated_at = NOW()
         WHERE id = ANY($1::int[])`,
        [ids],
      );
      updated += batch.length;
      console.log(`  Updated ${updated}/${changes.length}...`);
    }

    const { rows: after } = await prodPool.query(
      `SELECT status::text AS status, COUNT(*)::int AS c
       FROM listings
       GROUP BY status
       ORDER BY c DESC`,
    );
    console.log("\nProduction status after restore:", after);
    console.log("Done.");
  } finally {
    await backupPool.end();
    await prodPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
