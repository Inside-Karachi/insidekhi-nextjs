/**
 * One-time / idempotent migration: rewrite incorrectly migrated listing image URLs.
 *
 * Before:
 *   https://listing-images.sgp1.digitaloceanspaces.com/<key>
 * After (objects live in the default `insidekhi` bucket):
 *   https://insidekhi.sgp1.cdn.digitaloceanspaces.com/listing-images/<key>
 *
 * Usage:
 *   npx tsx scripts/rewrite-listing-image-urls.ts            # dry-run
 *   npx tsx scripts/rewrite-listing-image-urls.ts --apply    # write changes
 */
import "dotenv/config";
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");

async function createDbClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({
    connectionString: raw.split("?")[0],
    ssl: raw.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();
  return client;
}

function getRewritePrefixes() {
  const region = process.env.DO_SPACES_REGION || "sgp1";
  const bucket = process.env.DO_SPACES_BUCKET || "insidekhi";
  const cdn = (
    process.env.DO_SPACES_CDN_ENDPOINT ||
    `https://${bucket}.${region}.cdn.digitaloceanspaces.com/`
  ).replace(/\/?$/, "/");

  return {
    oldPrefix: `https://listing-images.${region}.digitaloceanspaces.com/`,
    newPrefix: `${cdn}listing-images/`,
  };
}

async function main() {
  const db = await createDbClient();
  const { oldPrefix, newPrefix } = getRewritePrefixes();

  console.log(
    `[rewrite-listing-image-urls] mode=${APPLY ? "APPLY" : "DRY-RUN"}`,
  );
  console.log(JSON.stringify({ oldPrefix, newPrefix }, null, 2));

  const candidates = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM listing_images
     WHERE url LIKE $1`,
    [oldPrefix + "%"],
  );

  const sample = await db.query<{ id: number; url: string; next_url: string }>(
    `SELECT id,
            url,
            replace(url, $1, $2) AS next_url
     FROM listing_images
     WHERE url LIKE $3
     ORDER BY id ASC
     LIMIT 3`,
    [oldPrefix, newPrefix, oldPrefix + "%"],
  );

  console.log(
    JSON.stringify(
      {
        candidates: Number(candidates.rows[0]?.count || 0),
        sample: sample.rows,
      },
      null,
      2,
    ),
  );

  if (!APPLY) {
    console.log(
      "[rewrite-listing-image-urls] dry-run complete; re-run with --apply to write.",
    );
    await db.end();
    return;
  }

  await db.query("BEGIN");
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS listing_images_url_rewrite_backup (
        id BIGINT PRIMARY KEY,
        old_url TEXT NOT NULL,
        new_url TEXT NOT NULL,
        rewritten_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(
      `INSERT INTO listing_images_url_rewrite_backup (id, old_url, new_url)
       SELECT id,
              url AS old_url,
              replace(url, $1, $2) AS new_url
       FROM listing_images
       WHERE url LIKE $3
       ON CONFLICT (id) DO UPDATE
         SET old_url = EXCLUDED.old_url,
             new_url = EXCLUDED.new_url,
             rewritten_at = NOW()`,
      [oldPrefix, newPrefix, oldPrefix + "%"],
    );

    const updated = await db.query(
      `UPDATE listing_images
       SET url = replace(url, $1, $2)
       WHERE url LIKE $3`,
      [oldPrefix, newPrefix, oldPrefix + "%"],
    );

    await db.query("COMMIT");

    const hosts = await db.query(
      `SELECT split_part(url, '/', 3) AS host, COUNT(*)::int AS images
       FROM listing_images
       GROUP BY 1
       ORDER BY images DESC`,
    );

    console.log(
      JSON.stringify(
        {
          rewritten: updated.rowCount,
          hosts_after: hosts.rows,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("[rewrite-listing-image-urls] failed:", error);
  process.exit(1);
});
