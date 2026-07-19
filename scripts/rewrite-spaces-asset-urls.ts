/**
 * Rewrite remaining DigitalOcean Spaces URLs that used fake bucket hostnames
 * (or the non-CDN default-bucket host) to the correct insidekhi CDN paths.
 *
 * Targets:
 * - form_submission_images.public_url (+ storage_path / storage_bucket)
 * - profiles.avatar_url
 * - banks.logo_url (standard host → CDN)
 * - social_shares.screenshot_url (rewrite when possible; report missing objects)
 *
 * Usage:
 *   npx tsx scripts/rewrite-spaces-asset-urls.ts            # dry-run
 *   npx tsx scripts/rewrite-spaces-asset-urls.ts --apply    # write changes
 */
import "dotenv/config";
import { Client } from "pg";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  GET_LISTED_IMAGES_PREFIX,
  PROFILES_AVATAR_PREFIX,
  SHARE_SCREENSHOTS_PREFIX,
  getPrefixedPublicUrl,
  rewriteDefaultBucketStandardUrlToCdn,
  rewriteFakeBucketHostUrl,
  toPrefixedObjectKey,
} from "../lib/storage/spaces";

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

function createSpacesClient() {
  const region = process.env.DO_SPACES_REGION || "sgp1";
  return new S3Client({
    endpoint:
      process.env.DO_SPACES_ENDPOINT ||
      `https://${region}.digitaloceanspaces.com`,
    region,
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY || "",
      secretAccessKey: process.env.DO_SPACES_SECRET || "",
    },
  });
}

async function listPrefixKeys(
  s3: S3Client,
  bucket: string,
  prefix: string,
): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}/`,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents || []) {
      if (object.Key) keys.add(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return keys;
}

type UpdatePlan = {
  table: string;
  id: string | number;
  oldUrl: string;
  newUrl: string;
  objectKey: string | null;
  extra?: Record<string, string>;
};

async function main() {
  const bucket = process.env.DO_SPACES_BUCKET || "insidekhi";
  const db = await createDbClient();
  const s3 = createSpacesClient();

  console.log(
    `[rewrite-spaces-asset-urls] mode=${APPLY ? "APPLY" : "DRY-RUN"} bucket=${bucket}`,
  );

  const [getListedKeys, avatarKeys, shareKeys, bankKeys] = await Promise.all([
    listPrefixKeys(s3, bucket, GET_LISTED_IMAGES_PREFIX),
    listPrefixKeys(s3, bucket, PROFILES_AVATAR_PREFIX),
    listPrefixKeys(s3, bucket, SHARE_SCREENSHOTS_PREFIX),
    listPrefixKeys(s3, bucket, "banks"),
  ]);

  const updates: UpdatePlan[] = [];
  const missing: Array<{
    table: string;
    id: string | number;
    url: string;
    objectKey: string | null;
  }> = [];

  // form_submission_images
  {
    const { rows } = await db.query<{
      id: string;
      public_url: string;
      storage_path: string | null;
      storage_bucket: string | null;
    }>(
      `SELECT id, public_url, storage_path, storage_bucket
       FROM form_submission_images
       WHERE public_url LIKE $1`,
      [`https://${GET_LISTED_IMAGES_PREFIX}.%digitaloceanspaces.com/%`],
    );

    for (const row of rows) {
      const newUrl = rewriteFakeBucketHostUrl(
        row.public_url,
        GET_LISTED_IMAGES_PREFIX,
      );
      if (!newUrl) continue;

      const relative = new URL(row.public_url).pathname.replace(/^\//, "");
      const objectKey = toPrefixedObjectKey(GET_LISTED_IMAGES_PREFIX, relative);
      if (!getListedKeys.has(objectKey)) {
        missing.push({
          table: "form_submission_images",
          id: row.id,
          url: row.public_url,
          objectKey,
        });
        continue;
      }

      updates.push({
        table: "form_submission_images",
        id: row.id,
        oldUrl: row.public_url,
        newUrl,
        objectKey,
        extra: {
          storage_path: objectKey,
          storage_bucket: bucket,
        },
      });
    }
  }

  // profiles.avatar_url
  {
    const { rows } = await db.query<{ id: string; avatar_url: string }>(
      `SELECT id, avatar_url
       FROM profiles
       WHERE avatar_url LIKE $1`,
      [`https://${PROFILES_AVATAR_PREFIX}.%digitaloceanspaces.com/%`],
    );

    for (const row of rows) {
      const newUrl = rewriteFakeBucketHostUrl(
        row.avatar_url,
        PROFILES_AVATAR_PREFIX,
      );
      if (!newUrl) continue;

      const relative = new URL(row.avatar_url).pathname.replace(/^\//, "");
      const objectKey = toPrefixedObjectKey(PROFILES_AVATAR_PREFIX, relative);
      if (!avatarKeys.has(objectKey)) {
        missing.push({
          table: "profiles",
          id: row.id,
          url: row.avatar_url,
          objectKey,
        });
        continue;
      }

      updates.push({
        table: "profiles",
        id: row.id,
        oldUrl: row.avatar_url,
        newUrl,
        objectKey,
      });
    }
  }

  // banks.logo_url (standard host → CDN)
  {
    const { rows } = await db.query<{ id: string; logo_url: string }>(
      `SELECT id, logo_url
       FROM banks
       WHERE logo_url LIKE $1`,
      [`https://${bucket}.%digitaloceanspaces.com/%`],
    );

    for (const row of rows) {
      // Skip URLs that are already on the CDN host
      if (row.logo_url.includes(".cdn.digitaloceanspaces.com")) continue;

      const newUrl = rewriteDefaultBucketStandardUrlToCdn(row.logo_url);
      if (!newUrl) continue;

      const objectKey = new URL(row.logo_url).pathname.replace(/^\//, "");
      if (!bankKeys.has(objectKey)) {
        missing.push({
          table: "banks",
          id: row.id,
          url: row.logo_url,
          objectKey,
        });
        continue;
      }

      updates.push({
        table: "banks",
        id: row.id,
        oldUrl: row.logo_url,
        newUrl,
        objectKey,
      });
    }
  }

  // social_shares.screenshot_url
  {
    const { rows } = await db.query<{ id: string; screenshot_url: string }>(
      `SELECT id, screenshot_url
       FROM social_shares
       WHERE screenshot_url LIKE $1`,
      [`https://${SHARE_SCREENSHOTS_PREFIX}.%digitaloceanspaces.com/%`],
    );

    for (const row of rows) {
      const newUrl = rewriteFakeBucketHostUrl(
        row.screenshot_url,
        SHARE_SCREENSHOTS_PREFIX,
      );
      if (!newUrl) continue;

      const relative = new URL(row.screenshot_url).pathname.replace(/^\//, "");
      const objectKey = toPrefixedObjectKey(SHARE_SCREENSHOTS_PREFIX, relative);
      if (!shareKeys.has(objectKey)) {
        missing.push({
          table: "social_shares",
          id: row.id,
          url: row.screenshot_url,
          objectKey,
        });
        continue;
      }

      updates.push({
        table: "social_shares",
        id: row.id,
        oldUrl: row.screenshot_url,
        newUrl,
        objectKey,
      });
    }
  }

  const byTable = updates.reduce<Record<string, number>>((acc, item) => {
    acc[item.table] = (acc[item.table] || 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        updates: updates.length,
        byTable,
        missing: missing.length,
        missingByTable: missing.reduce<Record<string, number>>((acc, item) => {
          acc[item.table] = (acc[item.table] || 0) + 1;
          return acc;
        }, {}),
        sampleUpdates: updates.slice(0, 5),
        sampleMissing: missing.slice(0, 5),
        exampleCorrected: getPrefixedPublicUrl(
          GET_LISTED_IMAGES_PREFIX,
          "13/example/original.webp",
        ),
      },
      null,
      2,
    ),
  );

  if (!APPLY) {
    console.log(
      "[rewrite-spaces-asset-urls] dry-run complete; re-run with --apply to write.",
    );
    await db.end();
    return;
  }

  await db.query("BEGIN");
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS spaces_asset_url_rewrite_backup (
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        old_url TEXT NOT NULL,
        new_url TEXT NOT NULL,
        rewritten_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (table_name, row_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS spaces_asset_url_rewrite_missing (
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        url TEXT NOT NULL,
        object_key TEXT,
        reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (table_name, row_id)
      )
    `);

    for (const item of updates) {
      await db.query(
        `INSERT INTO spaces_asset_url_rewrite_backup (table_name, row_id, old_url, new_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (table_name, row_id) DO UPDATE
           SET old_url = EXCLUDED.old_url,
               new_url = EXCLUDED.new_url,
               rewritten_at = NOW()`,
        [item.table, String(item.id), item.oldUrl, item.newUrl],
      );

      if (item.table === "form_submission_images") {
        await db.query(
          `UPDATE form_submission_images
           SET public_url = $1,
               storage_path = $2,
               storage_bucket = $3
           WHERE id = $4`,
          [
            item.newUrl,
            item.extra?.storage_path,
            item.extra?.storage_bucket,
            item.id,
          ],
        );
      } else if (item.table === "profiles") {
        await db.query(
          `UPDATE profiles SET avatar_url = $1 WHERE id = $2`,
          [item.newUrl, item.id],
        );
      } else if (item.table === "banks") {
        await db.query(`UPDATE banks SET logo_url = $1 WHERE id = $2`, [
          item.newUrl,
          item.id,
        ]);
      } else if (item.table === "social_shares") {
        await db.query(
          `UPDATE social_shares SET screenshot_url = $1 WHERE id = $2`,
          [item.newUrl, item.id],
        );
      }
    }

    for (const item of missing) {
      await db.query(
        `INSERT INTO spaces_asset_url_rewrite_missing (table_name, row_id, url, object_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (table_name, row_id) DO UPDATE
           SET url = EXCLUDED.url,
               object_key = EXCLUDED.object_key,
               reported_at = NOW()`,
        [item.table, String(item.id), item.url, item.objectKey],
      );
    }

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  console.log(
    JSON.stringify(
      {
        rewritten: updates.length,
        missing_reported: missing.length,
      },
      null,
      2,
    ),
  );

  await db.end();
}

main().catch((error) => {
  console.error("[rewrite-spaces-asset-urls] failed:", error);
  process.exit(1);
});
