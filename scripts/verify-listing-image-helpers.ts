/**
 * Lightweight assertions for listing-image Spaces URL helpers.
 * Run with: npx tsx scripts/verify-listing-image-helpers.ts
 */
import assert from "node:assert/strict";
import {
  getListingImageKeyFromUrl,
  getListingImagePublicUrl,
  rewriteLegacyListingImageUrl,
  toListingImageObjectKey,
} from "../lib/storage/spaces";

const region = process.env.DO_SPACES_REGION || "sgp1";
const bucket = process.env.DO_SPACES_BUCKET || "insidekhi";
const cdnBase = (
  process.env.DO_SPACES_CDN_ENDPOINT ||
  `https://${bucket}.${region}.cdn.digitaloceanspaces.com/`
).replace(/\/?$/, "/");

function run() {
  assert.equal(
    toListingImageObjectKey("peekaboo/1/a.jpg"),
    "listing-images/peekaboo/1/a.jpg",
  );
  assert.equal(
    toListingImageObjectKey("listing-images/peekaboo/1/a.jpg"),
    "listing-images/peekaboo/1/a.jpg",
  );

  const publicUrl = getListingImagePublicUrl("peekaboo/1/a.jpg");
  assert.equal(publicUrl, `${cdnBase}listing-images/peekaboo/1/a.jpg`);

  const legacyUrl = `https://listing-images.${region}.digitaloceanspaces.com/peekaboo/1/a.jpg`;
  assert.equal(
    rewriteLegacyListingImageUrl(legacyUrl),
    `${cdnBase}listing-images/peekaboo/1/a.jpg`,
  );
  assert.equal(
    getListingImageKeyFromUrl(legacyUrl),
    "listing-images/peekaboo/1/a.jpg",
  );
  assert.equal(
    getListingImageKeyFromUrl(`${cdnBase}listing-images/peekaboo/1/a.jpg`),
    "listing-images/peekaboo/1/a.jpg",
  );
  assert.equal(
    getListingImageKeyFromUrl(
      "https://example.supabase.co/storage/v1/object/public/listing-images/peekaboo/1/a.jpg",
    ),
    "listing-images/peekaboo/1/a.jpg",
  );
  assert.equal(getListingImageKeyFromUrl("https://example.com/other.jpg"), null);

  console.log("verify-listing-image-helpers: all assertions passed");
}

run();
