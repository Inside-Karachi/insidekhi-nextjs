/**
 * Build new-from-scratch categories taxonomy Excel (no DB writes).
 *
 * Run: npx tsx scripts/build-new-categories-excel.ts
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

type SubcategoryRow = {
  parentName: string;
  parentSlug: string;
  name: string;
  slug: string;
  displayOrder: number;
  peekabooTags: string[];
};

const PARENT_SLUGS: Record<string, string> = {
  "Food & Dining": "food-dining",
  "Shopping & Fashion": "shopping-fashion",
  "Health & Wellness": "health-wellness",
  "Beauty & Personal Care": "beauty-personal-care",
  "Services & Living": "services-living",
  "Education & Learning": "education-learning",
};

/** Prefer more-specific subcategory when the same Peekaboo tag appears twice */
const TAG_OVERRIDE_SLUG: Record<string, string> = {
  Pakistani: "pakistani-desi-cuisine",
};

function parentSlugFor(name: string): string {
  const slug = PARENT_SLUGS[name];
  if (!slug) {
    throw new Error(`Unknown parent category: ${name}`);
  }
  return slug;
}

/**
 * Parse markdown/CSV source. Handles quoted fields and commas inside subcategory names
 * (e.g. "Real Estate, Venues & Rentals").
 */
function parseTaxonomyCsv(content: string): SubcategoryRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Taxonomy file has no data rows");
  }

  const rows: SubcategoryRow[] = [];
  let displayOrder = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 4) {
      throw new Error(`Bad row ${i + 1}: expected 4 columns, got ${cols.length}: ${lines[i]}`);
    }
    const [parentName, name, slug, tagsRaw] = cols;
    const peekabooTags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    displayOrder += 1;
    rows.push({
      parentName,
      parentSlug: parentSlugFor(parentName),
      name,
      slug,
      displayOrder,
      peekabooTags,
    });
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function buildTagMap(subs: SubcategoryRow[]): {
  tagMap: {
    peekaboo_tag: string;
    subcategory_slug: string;
    subcategory_name: string;
    parent_name: string;
    conflict_note: string;
  }[];
  conflicts: string[];
} {
  const firstByTag = new Map<
    string,
    { slug: string; name: string; parent: string }
  >();
  const conflicts: string[] = [];

  for (const sub of subs) {
    for (const tag of sub.peekabooTags) {
      const existing = firstByTag.get(tag);
      if (!existing) {
        firstByTag.set(tag, {
          slug: sub.slug,
          name: sub.name,
          parent: sub.parentName,
        });
        continue;
      }
      if (existing.slug !== sub.slug) {
        conflicts.push(
          `${tag}: ${existing.slug} vs ${sub.slug}`,
        );
      }
    }
  }

  const bySlug = new Map(subs.map((s) => [s.slug, s]));

  const tagMap = [...firstByTag.entries()]
    .map(([tag, first]) => {
      const overrideSlug = TAG_OVERRIDE_SLUG[tag];
      let finalSlug = first.slug;
      let conflictNote = "";

      if (overrideSlug && bySlug.has(overrideSlug)) {
        if (overrideSlug !== first.slug) {
          conflictNote = `overlap resolved → prefer ${overrideSlug} over ${first.slug}`;
        }
        finalSlug = overrideSlug;
      } else if (conflicts.some((c) => c.startsWith(`${tag}:`))) {
        conflictNote = `overlap; kept first occurrence (${first.slug})`;
      }

      const sub = bySlug.get(finalSlug)!;
      return {
        peekaboo_tag: tag,
        subcategory_slug: sub.slug,
        subcategory_name: sub.name,
        parent_name: sub.parentName,
        conflict_note: conflictNote,
      };
    })
    .sort((a, b) => a.peekaboo_tag.localeCompare(b.peekaboo_tag));

  return { tagMap, conflicts };
}

function main(): void {
  const root = process.cwd();
  const sourcePath = path.join(root, "docs/new-categories-and-subcategories.md");
  const outDir = path.join(root, "exports");
  const outPath = path.join(outDir, "new-categories-taxonomy.xlsx");

  const content = fs.readFileSync(sourcePath, "utf8");
  const subs = parseTaxonomyCsv(content);

  const parentOrder = Object.keys(PARENT_SLUGS);
  const categories = parentOrder.map((name, idx) => ({
    name,
    slug: PARENT_SLUGS[name],
    display_order: idx + 1,
    category_type: "listing",
    is_enabled: true,
  }));

  const subcategories = subs.map((s) => ({
    parent_name: s.parentName,
    parent_slug: s.parentSlug,
    name: s.name,
    slug: s.slug,
    display_order: s.displayOrder,
    peekaboo_tags: s.peekabooTags.join(", "),
    is_enabled: true,
  }));

  const { tagMap, conflicts } = buildTagMap(subs);

  const gapTags = [
    "Automakers",
    "Wedding Halls",
    "Repair and Maintanance",
    "Banking / Finance (if any)",
    "Other rare tags from exports/unmatched-tags.csv not listed in this taxonomy",
  ];

  const reviewNotes = [
    {
      note: "From-scratch taxonomy: 6 parents, 24 subcategories. Not linked to existing DB category IDs.",
    },
    {
      note: "No database writes — Excel only.",
    },
    {
      note: "Subcategory names with commas (Real Estate, Venues & Rentals; Colleges, Universities & Institutes) are single cells; slugs unchanged.",
    },
    {
      note: `Tag overlaps found: ${conflicts.length ? conflicts.join("; ") : "none"}. Pakistani → pakistani-desi-cuisine by override.`,
    },
    {
      note: `Order-Now maps to fast-food-street-food; E-Store/e-stores → e-commerce-online-stores.`,
    },
    {
      note: `Possible gap tags still to add later: ${gapTags.join("; ")}.`,
    },
    {
      note: "Hotels live under Travel & Tourism (services-living), not a separate Where to Stay parent.",
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(categories),
    "Categories",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(subcategories),
    "Subcategories",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tagMap), "Tag_Map");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(reviewNotes),
    "Review_Notes",
  );

  fs.mkdirSync(outDir, { recursive: true });
  XLSX.writeFile(wb, outPath);

  console.log("=== New categories taxonomy Excel (no DB writes) ===");
  console.log(`Parents:        ${categories.length}`);
  console.log(`Subcategories:  ${subcategories.length}`);
  console.log(`Tag map rows:   ${tagMap.length}`);
  console.log(`Tag overlaps:   ${conflicts.length}`);
  if (conflicts.length) {
    for (const c of conflicts) console.log(`  - ${c}`);
  }
  console.log(`Wrote: ${outPath}`);
}

main();
