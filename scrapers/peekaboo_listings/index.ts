#!/usr/bin/env tsx
// Listing scraper entry point.
// Usage: npm run scrape:listings [-- --limit N] [-- --dry-run]
// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createAPIClient } from "./core/api-client";
import { EntityScraper } from "./scrapers/entity-scraper";
import { categoryMapper } from "./transformers/category-mapper";
import { SCRAPER_CONFIG } from "./config";
import { setupSignalHandlers, setupExitHandler } from "./utils/signal-handlers";
import type {
  ScraperContext,
  ScraperStats,
} from "@/types/peekaboo-scraper.types";
import fs from "fs/promises";
import path from "path";

// Parse command line arguments with robust handling for npm quirks
const args = process.argv.slice(2);
let limit: string | undefined;
let entityId: string | undefined;
let dryRun = false;
let resetSequences = false;

// Debug: Log received arguments
console.log("[DEBUG] Received arguments:", args);

// Collect all numeric arguments first (for smart parsing)
const numericArgs: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === "--dry-run" || arg === "dry-run") {
    dryRun = true;
  } else if (arg === "--reset-sequences" || arg === "reset-sequences") {
    resetSequences = true;
  } else if (arg.startsWith("--limit=")) {
    limit = arg.split("=")[1];
  } else if (arg === "--limit" || arg === "limit") {
    if (args[i + 1] && !args[i + 1].startsWith("-")) {
      limit = args[i + 1];
      i++; // Skip next arg
    }
  } else if (arg.startsWith("--entity-id=")) {
    entityId = arg.split("=")[1];
  } else if (arg === "--entity-id" || arg === "entity-id") {
    if (args[i + 1] && !args[i + 1].startsWith("-")) {
      entityId = args[i + 1];
      i++; // Skip next arg
    }
  } else if (!arg.startsWith("-") && !isNaN(Number(arg))) {
    // Collect all plain numbers for smart parsing
    numericArgs.push(arg);
  }
}

// Positional numeric args: one number = entity-id; two numbers = limit + entity-id.
if (!limit && !entityId && numericArgs.length > 0) {
  if (numericArgs.length === 1) {
    // Single number = entity-id (for testing specific entities)
    entityId = numericArgs[0];
    console.log(`[CLI] Detected single entity mode: entity-id=${entityId}`);
  } else if (numericArgs.length >= 2) {
    // Two numbers = limit + entity-id
    limit = numericArgs[0];
    entityId = numericArgs[1];
    console.log(
      `[CLI] Detected dual mode: limit=${limit}, entity-id=${entityId}`,
    );
  }
}

/**
 * Reset PostgreSQL sequences to start from 1
 * WARNING: Only use this when restarting fresh (all listings deleted)
 */
async function resetDatabaseSequences(): Promise<void> {
  console.log("\nRESETTING DATABASE SEQUENCES...");
  console.log(
    "This will reset listing, branch, and image IDs to start from 1.",
  );

  const { query } = await import("@/lib/db");

  try {
    // Check if tables are empty
    const [
      { rows: listingsRows },
      { rows: branchesRows },
      { rows: imagesRows },
      { rows: hoursRows },
    ] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM listings"),
      query("SELECT COUNT(*)::int AS count FROM listing_branches"),
      query("SELECT COUNT(*)::int AS count FROM listing_images"),
      query("SELECT COUNT(*)::int AS count FROM opening_hours"),
    ]);

    const listingsCount = listingsRows[0]?.count ?? 0;
    const branchesCount = branchesRows[0]?.count ?? 0;
    const imagesCount = imagesRows[0]?.count ?? 0;
    const hoursCount = hoursRows[0]?.count ?? 0;

    if (listingsCount || branchesCount || imagesCount || hoursCount) {
      console.warn(`\nWARNING: Tables are NOT empty!`);
      console.warn(`   Listings: ${listingsCount}`);
      console.warn(`   Branches: ${branchesCount}`);
      console.warn(`   Images: ${imagesCount}`);
      console.warn(`   Opening Hours: ${hoursCount}`);
      console.warn(
        `\nSequence reset SKIPPED. Please delete all records first using:`,
      );
      console.warn(`   DELETE FROM listings WHERE peekaboo_id IS NOT NULL;`);
      console.warn(`   (This will cascade to branches, images, and hours)\n`);
      return;
    }

    console.log("\nAll tables are empty. Safe to reset sequences.");
    console.log(
      "\nTo reset sequences, run the following SQL against the Postgres database:",
    );
    console.log("-".repeat(60));
    console.log("ALTER SEQUENCE listings_id_seq RESTART WITH 1;");
    console.log("ALTER SEQUENCE listing_branches_id_seq RESTART WITH 1;");
    console.log("ALTER SEQUENCE listing_images_id_seq RESTART WITH 1;");
    console.log("ALTER SEQUENCE opening_hours_id_seq RESTART WITH 1;");
    console.log("-".repeat(60));
    console.log(
      "\nCopy and paste the above SQL and run it against the database manually.",
    );
    console.log("This ensures sequences start from 1 for the next import.\n");
  } catch (error) {
    console.error("Error checking sequences:", error);
    throw error;
  }
}

/**
 * Initialize scraper context
 */
function createContext(): ScraperContext {
  const stats: ScraperStats = {
    entitiesProcessed: 0,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    entitiesSkipped: 0,
    imagesSynced: 0,
    branchesSynced: 0,
    errors: 0,
    startTime: new Date(),
  };

  return {
    token: "",
    config: SCRAPER_CONFIG,
    stats,
  };
}

/**
 * Generate sync report
 */
async function generateReport(context: ScraperContext): Promise<void> {
  const reportDir = path.join(process.cwd(), "scrapers", "reports");
  await fs.mkdir(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    reportDir,
    `peekaboo-listings-${timestamp}.json`,
  );

  const duration = Date.now() - context.stats.startTime.getTime();
  const report = {
    ...context.stats,
    endTime: new Date(),
    durationMs: duration,
    durationMinutes: (duration / 60000).toFixed(2),
    config: {
      city: context.config.city,
      country: context.config.country,
      dryRun,
      limit: limit ? parseInt(limit) : null,
    },
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n[REPORT] Saved to: ${reportPath}`);
}

/**
 * Display summary statistics
 */
function displaySummary(context: ScraperContext): void {
  const { stats } = context;
  const duration = Date.now() - stats.startTime.getTime();

  console.log("\n" + "=".repeat(60));
  console.log("SCRAPING SUMMARY");
  console.log("=".repeat(60));
  console.log(`Duration: ${(duration / 60000).toFixed(2)} minutes`);
  console.log(`Entities Processed: ${stats.entitiesProcessed}`);
  console.log(`Entities Created: ${stats.entitiesCreated}`);
  console.log(`Entities Updated: ${stats.entitiesUpdated}`);
  console.log(`Entities Skipped: ${stats.entitiesSkipped}`);
  console.log(`Images Synced: ${stats.imagesSynced}`);
  console.log(`Branches Synced: ${stats.branchesSynced}`);
  console.log(`Errors: ${stats.errors}`);
  console.log("=".repeat(60) + "\n");
}

/**
 * Main scraper function
 */
async function main(): Promise<void> {
  // Setup graceful shutdown handlers (Ctrl+C, SIGTERM, etc.)
  setupSignalHandlers();
  setupExitHandler();

  console.log("\n" + "=".repeat(60));
  console.log("PEEKABOO LISTING SCRAPER");
  console.log("=".repeat(60));
  console.log(`City: ${SCRAPER_CONFIG.city}`);
  console.log(`Country: ${SCRAPER_CONFIG.country}`);
  console.log(`Dry Run: ${dryRun ? "YES" : "NO"}`);
  if (entityId) {
    console.log(`Target Entity ID: ${entityId}`);
  } else {
    console.log(`Limit: ${limit || "ALL"}`);
  }
  console.log(`Reset Sequences: ${resetSequences ? "YES" : "NO"}`);
  console.log("=".repeat(60) + "\n");

  // Reset sequences if requested
  if (resetSequences) {
    await resetDatabaseSequences();
  }

  // Initialize context
  const context = createContext();

  let apiClient: InstanceType<
    typeof import("./core/api-client").PeekabooAPIClient
  > | null = null;

  try {
    // Step 1: Authenticate and create API client
    console.log("[STEP 1/5] Authenticating...");
    apiClient = await createAPIClient(context);
    console.log("[STEP 1/5] Authentication successful\n");

    // Step 2: Load category mappings
    console.log("[STEP 2/5] Loading category mappings...");
    await categoryMapper.loadCategories();
    console.log("[STEP 2/5] Category mappings loaded\n");

    // Step 3: Fetch all entity IDs
    console.log("[STEP 3/5] Fetching entity IDs from Peekaboo...");
    const scraper = new EntityScraper(apiClient, context);
    let entityIds = await scraper.getAllEntityIds();

    // Apply entity ID filter if specified (single entity mode)
    if (entityId) {
      const targetId = parseInt(entityId);
      console.log(`[STEP 3/5] Filtering for specific entity ID: ${targetId}`);

      const foundEntity = entityIds.find((e) => e.id === targetId);
      if (foundEntity) {
        entityIds = [foundEntity];
        console.log(
          `[STEP 3/5] Found target entity ${targetId} (${foundEntity.slug})\n`,
        );
      } else {
        console.log(
          `[STEP 3/5] Entity ${targetId} not found in Peekaboo list. Creating placeholder...\n`,
        );
        entityIds = [{ id: targetId, slug: `entity-${targetId}` }];
      }
    }
    // Apply limit if specified (multiple entities mode)
    else if (limit) {
      const limitNum = parseInt(limit);
      console.log(`[STEP 3/5] Limiting to first ${limitNum} entities\n`);
      entityIds = entityIds.slice(0, limitNum);
    }

    console.log(`[STEP 3/5] Found ${entityIds.length} entities to process\n`);

    if (entityIds.length === 0) {
      console.log("No entities found. Exiting...");
      return;
    }

    // Step 4: Process entities
    console.log("[STEP 4/5] Processing entities...");

    const outputDir = path.join(process.cwd(), "scrapers", "output");
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, "peekaboo-listings-latest.json");
    const processedListings = [];

    let processedCount = 0;
    const totalEntities = entityIds.length;

    for await (const processed of scraper.processBatch(entityIds)) {
      processedCount++;
      processedListings.push({
        listing: processed.listing,
        branches: processed.branches,
        images: [], // Images now uploaded via database-sync, not here
      });

      // Progress logging
      const percentage = ((processedCount / totalEntities) * 100).toFixed(1);
      console.log(
        `[PROGRESS] ${processedCount}/${totalEntities} (${percentage}%) - ${processed.listing.name}`,
      );

      // Save intermediate results every 10 entities
      if (processedListings.length % 10 === 0) {
        console.log(
          `[CHECKPOINT] Saving progress... (${processedListings.length} entities)`,
        );
        await fs.writeFile(
          outputPath,
          JSON.stringify({ listings: processedListings }, null, 2),
        );
      }
    }

    // Save final results
    await fs.writeFile(
      outputPath,
      JSON.stringify({ listings: processedListings }, null, 2),
    );

    console.log(`\n[STEP 4/5] Processed ${processedListings.length} entities`);
    console.log(`[STEP 4/5] Output saved to: ${outputPath}\n`);

    // Step 5: Generate report
    console.log("[STEP 5/5] Generating report...");
    context.stats.endTime = new Date();
    await generateReport(context);
    console.log("[STEP 5/5] Report generated\n");

    // Display summary
    displaySummary(context);

    if (dryRun) {
      console.log("DRY RUN MODE: No data was saved to the database.");
      console.log(
        "Review the output file and run without --dry-run to import.\n",
      );
    } else {
      console.log("SCRAPING COMPLETE!");
      console.log(
        "Next step: Import listings to database using the admin panel.\n",
      );
    }
  } catch (error) {
    const mainError = error as Error;
    console.error("\nSCRAPER ERROR:", mainError.message);
    console.error(mainError.stack);

    context.stats.endTime = new Date();
    await generateReport(context);

    process.exit(1);
  } finally {
    // Cleanup
    if (apiClient) {
      await apiClient.close();
    }
  }
}

// Run the scraper
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
