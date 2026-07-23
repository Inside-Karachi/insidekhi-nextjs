/**
 * READ-ONLY: export listings + apply Peekaboo tag → subcategory map into CSV only.
 * Never INSERT / UPDATE / DELETE.
 *
 * Run: npx tsx scripts/export-listing-categories-csv.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import {
  PEEKABOO_TAGS_LEFT_UNMATCHED,
  resolveCategorySlugFromTags,
} from "../scrapers/peekaboo_listings/transformers/peekaboo-tag-category-map";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  parent_name: string | null;
};

type ListingRow = {
  id: number;
  name: string;
  slug: string | null;
  status: string;
  peekaboo_id: string | null;
  category_id: number | null;
  category_name: string | null;
  parent_category_name: string | null;
  custom_attributes: Record<string, unknown> | null;
};

type MatchMethod = "existing" | "tag_map" | "unmatched";

type ExportRow = {
  id: number;
  name: string;
  slug: string;
  status: string;
  peekaboo_id: string;
  peekaboo_tags: string;
  category_id: string;
  category_name: string;
  parent_category_name: string;
  proposed_category_id: string;
  proposed_subcategory: string;
  proposed_parent: string;
  matched_tag: string;
  match_method: MatchMethod;
};

type UnmatchedListingRow = {
  id: number;
  name: string;
  status: string;
  peekaboo_id: string;
  peekaboo_tags: string;
  reason: "no_tags" | "tags_not_in_map";
};

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv<T extends Record<string, string | number>>(
  filePath: string,
  headers: (keyof T & string)[],
  rows: T[],
): void {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function extractPeekabooTags(
  customAttributes: Record<string, unknown> | null,
): string[] {
  const raw = customAttributes?.peekaboo_tags;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "tag" in item) {
        const tag = (item as { tag?: unknown }).tag;
        return typeof tag === "string" ? tag.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const cleanConnectionString = connectionString.split("?")[0];
  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 2,
  });

  const outDir = path.join(process.cwd(), "exports");
  fs.mkdirSync(outDir, { recursive: true });

  try {
    // READ-ONLY: categories
    const { rows: categoryRows } = await pool.query<CategoryRow>(
      `SELECT
         c.id,
         c.name,
         c.slug,
         c.parent_id,
         p.name AS parent_name
       FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id`,
    );

    const bySlug = new Map<string, CategoryRow>();
    const byId = new Map<number, CategoryRow>();
    for (const cat of categoryRows) {
      bySlug.set(cat.slug, cat);
      byId.set(cat.id, cat);
    }

    // READ-ONLY: listings
    const { rows: listings } = await pool.query<ListingRow>(
      `SELECT
         l.id,
         l.name,
         l.slug,
         l.status,
         l.peekaboo_id::text AS peekaboo_id,
         l.category_id,
         c.name AS category_name,
         p.name AS parent_category_name,
         l.custom_attributes
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       ORDER BY l.id ASC`,
    );

    const exportRows: ExportRow[] = [];
    const unmatchedListings: UnmatchedListingRow[] = [];
    const unmatchedTagCounts = new Map<string, number>();

    let existingCount = 0;
    let tagMapCount = 0;
    let unmatchedCount = 0;
    let noTagsCount = 0;

    for (const listing of listings) {
      const tags = extractPeekabooTags(listing.custom_attributes);
      const peekabooTagsJoined = tags.join(" | ");

      if (listing.category_id != null) {
        const current = byId.get(listing.category_id);
        existingCount += 1;
        exportRows.push({
          id: listing.id,
          name: listing.name ?? "",
          slug: listing.slug ?? "",
          status: listing.status ?? "",
          peekaboo_id: listing.peekaboo_id ?? "",
          peekaboo_tags: peekabooTagsJoined,
          category_id: String(listing.category_id),
          category_name: listing.category_name ?? current?.name ?? "",
          parent_category_name:
            listing.parent_category_name ?? current?.parent_name ?? "",
          proposed_category_id: String(listing.category_id),
          proposed_subcategory: listing.category_name ?? current?.name ?? "",
          proposed_parent:
            listing.parent_category_name ?? current?.parent_name ?? "",
          matched_tag: "",
          match_method: "existing",
        });
        continue;
      }

      const resolved = resolveCategorySlugFromTags(tags);
      if (resolved) {
        const proposed = bySlug.get(resolved.slug);
        if (!proposed) {
          // Slug in map but missing from DB — treat as unmatched
          unmatchedCount += 1;
          if (tags.length === 0) noTagsCount += 1;
          for (const tag of tags) {
            if (PEEKABOO_TAGS_LEFT_UNMATCHED.has(tag)) continue;
            unmatchedTagCounts.set(tag, (unmatchedTagCounts.get(tag) ?? 0) + 1);
          }
          unmatchedListings.push({
            id: listing.id,
            name: listing.name ?? "",
            status: listing.status ?? "",
            peekaboo_id: listing.peekaboo_id ?? "",
            peekaboo_tags: peekabooTagsJoined,
            reason: tags.length === 0 ? "no_tags" : "tags_not_in_map",
          });
          exportRows.push({
            id: listing.id,
            name: listing.name ?? "",
            slug: listing.slug ?? "",
            status: listing.status ?? "",
            peekaboo_id: listing.peekaboo_id ?? "",
            peekaboo_tags: peekabooTagsJoined,
            category_id: "",
            category_name: "",
            parent_category_name: "",
            proposed_category_id: "",
            proposed_subcategory: "",
            proposed_parent: "",
            matched_tag: resolved.matchedTag,
            match_method: "unmatched",
          });
          continue;
        }

        tagMapCount += 1;
        exportRows.push({
          id: listing.id,
          name: listing.name ?? "",
          slug: listing.slug ?? "",
          status: listing.status ?? "",
          peekaboo_id: listing.peekaboo_id ?? "",
          peekaboo_tags: peekabooTagsJoined,
          category_id: "",
          category_name: "",
          parent_category_name: "",
          proposed_category_id: String(proposed.id),
          proposed_subcategory: proposed.name,
          proposed_parent: proposed.parent_name ?? "",
          matched_tag: resolved.matchedTag,
          match_method: "tag_map",
        });
        continue;
      }

      unmatchedCount += 1;
      const reason = tags.length === 0 ? "no_tags" : "tags_not_in_map";
      if (reason === "no_tags") noTagsCount += 1;

      for (const tag of tags) {
        unmatchedTagCounts.set(tag, (unmatchedTagCounts.get(tag) ?? 0) + 1);
      }

      unmatchedListings.push({
        id: listing.id,
        name: listing.name ?? "",
        status: listing.status ?? "",
        peekaboo_id: listing.peekaboo_id ?? "",
        peekaboo_tags: peekabooTagsJoined,
        reason,
      });

      exportRows.push({
        id: listing.id,
        name: listing.name ?? "",
        slug: listing.slug ?? "",
        status: listing.status ?? "",
        peekaboo_id: listing.peekaboo_id ?? "",
        peekaboo_tags: peekabooTagsJoined,
        category_id: "",
        category_name: "",
        parent_category_name: "",
        proposed_category_id: "",
        proposed_subcategory: "",
        proposed_parent: "",
        matched_tag: "",
        match_method: "unmatched",
      });
    }

    const mainPath = path.join(outDir, "listings-with-categories.csv");
    const unmatchedPath = path.join(outDir, "listings-unmatched.csv");
    const unmatchedTagsPath = path.join(outDir, "unmatched-tags.csv");

    writeCsv(
      mainPath,
      [
        "id",
        "name",
        "slug",
        "status",
        "peekaboo_id",
        "peekaboo_tags",
        "category_id",
        "category_name",
        "parent_category_name",
        "proposed_category_id",
        "proposed_subcategory",
        "proposed_parent",
        "matched_tag",
        "match_method",
      ],
      exportRows,
    );

    writeCsv(
      unmatchedPath,
      ["id", "name", "status", "peekaboo_id", "peekaboo_tags", "reason"],
      unmatchedListings,
    );

    const unmatchedTagRows = [...unmatchedTagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, listing_count]) => ({ tag, listing_count }));

    writeCsv(unmatchedTagsPath, ["tag", "listing_count"], unmatchedTagRows);

    const previouslyUncategorized = tagMapCount + unmatchedCount;
    console.log("=== Listing category CSV export (READ-ONLY) ===");
    console.log(`Total listings:              ${listings.length}`);
    console.log(`match_method=existing:       ${existingCount}`);
    console.log(`match_method=tag_map:        ${tagMapCount}`);
    console.log(`match_method=unmatched:      ${unmatchedCount}`);
    console.log(`  of which no_tags:          ${noTagsCount}`);
    console.log(`  of which tags_not_in_map:  ${unmatchedCount - noTagsCount}`);
    console.log(
      `Coverage of uncategorized:   ${tagMapCount}/${previouslyUncategorized} proposed via tag_map`,
    );
    console.log("");
    console.log("Wrote:");
    console.log(`  ${mainPath}`);
    console.log(`  ${unmatchedPath}`);
    console.log(`  ${unmatchedTagsPath}`);
    console.log("");
    console.log("Top unmatched tags:");
    for (const row of unmatchedTagRows.slice(0, 25)) {
      console.log(`  ${row.listing_count}\t${row.tag}`);
    }
    console.log("");
    console.log("Database was not modified.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
