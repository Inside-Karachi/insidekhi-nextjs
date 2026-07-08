// Syncs scraped listings (and their branches/images) to the database by peekaboo_id.

import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type {
  MappedListing,
  MappedBranch,
  MappedImage,
  SyncResult,
  SyncAction,
} from "@/types/peekaboo-scraper.types";
import type { ListingBranch } from "@/types/listing.types";

type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

// ============================================================================
// TYPES
// ============================================================================

export interface SyncOptions {
  /**
   * If true, automatically publish listings (status = 'published')
   * If false, keep as draft for manual review
   */
  autoPublish?: boolean;

  /**
   * If true, preserve manual edits (skip update if listing has been modified)
   * If false, always overwrite with Peekaboo data
   */
  preserveManualEdits?: boolean;

  /**
   * If true, create change requests for existing listings instead of direct updates
   */
  createChangeRequests?: boolean;
}

export interface ConflictInfo {
  field: string;
  currentValue: unknown;
  incomingValue: unknown;
}

export interface SyncDecisionResult {
  action: SyncAction;
  listingId?: number;
  conflicts: ConflictInfo[];
  hasManualEdits: boolean;
}

// ============================================================================
// DATABASE SYNC CLASS
// ============================================================================

export class DatabaseSync {
  private static sharedClient: Awaited<
    ReturnType<typeof createServerSupabase>
  > | null = null; // Singleton connection pool
  private static bankCache: Map<string, number> = new Map(); // Cache bank name -> ID lookups
  private supabase: Awaited<ReturnType<typeof createServerSupabase>> | null =
    null;
  private options: Required<SyncOptions>;
  private uploadedImageUrls: string[] = []; // Track uploaded images for rollback

  constructor(options: SyncOptions = {}) {
    // Will be initialized in init()

    this.options = {
      autoPublish: options.autoPublish ?? false,
      preserveManualEdits: options.preserveManualEdits ?? true,
      createChangeRequests: options.createChangeRequests ?? false,
    };
  }

  /**
   * Initialize the sync module (must be called before use)
   * Creates service role client for database operations
   * Uses shared client for connection pooling
   */
  async init(): Promise<void> {
    // Reuse shared client if available
    if (DatabaseSync.sharedClient) {
      this.supabase = DatabaseSync.sharedClient;
      return;
    }

    // Create new client and cache it
    this.supabase = await createServerSupabase({ useServiceRole: true });
    DatabaseSync.sharedClient = this.supabase;
  }

  /**
   * Sync a single listing with all its branches and images
   * OPTIMIZED: Images uploaded AFTER listing insert to prevent orphans
   */
  async syncListing(
    listing: MappedListing,
    branches: MappedBranch[],
    pendingImages: import("@/types/peekaboo-scraper.types").PendingImage[],
    deals?: MappedListing["deals"],
  ): Promise<SyncResult> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized. Call init() first.");
    }

    const peekabooId = listing.peekaboo_id;
    this.uploadedImageUrls = []; // Reset for this listing

    try {
      // Step 1: Check if listing already exists
      const decision = await this.decideSyncAction(listing);

      if (decision.action === "skip") {
        return {
          peekabooId,
          action: "skip",
          success: true,
          details: {
            imagesProcessed: 0,
            branchesProcessed: 0,
            categoryMapped: false,
          },
        };
      }

      // Step 2: Upsert listing FIRST (before any images)
      const listingId = await this.upsertListing(listing, decision);

      // Step 3: Upload images AFTER listing exists (prevents orphans)
      const imagesProcessed = await this.uploadAndLinkImages(
        listingId,
        pendingImages,
        listing.peekaboo_id,
      );

      // Step 4: Sync branches
      const branchIdMap = await this.syncBranches(listingId, branches);

      // Step 5: Sync opening hours
      await this.syncOpeningHours(listingId, listing, branches, branchIdMap);

      // Step 6: Sync deals
      let dealsProcessed = 0;
      if (deals && deals.length > 0) {
        dealsProcessed = await this.syncDeals(listingId, deals);
      }

      // Success - clear rollback tracking
      this.uploadedImageUrls = [];

      return {
        peekabooId,
        action: decision.action,
        listingId,
        success: true,
        details: {
          imagesProcessed,
          branchesProcessed: branchIdMap.size,
          dealsProcessed, // Add deals to result
          categoryMapped: listing.category_id !== null,
        },
      };
    } catch (error) {
      const syncError = error as Error;
      console.error(`[SYNC] Failed to sync listing ${peekabooId}:`, syncError);

      // ROLLBACK: Clean up any uploaded images
      await this.rollbackImages();

      return {
        peekabooId,
        action: "skip",
        success: false,
        error: syncError.message,
        details: {
          imagesProcessed: 0,
          branchesProcessed: 0,
          categoryMapped: false,
        },
      };
    }
  }

  /**
   * Rollback uploaded images on sync failure
   * FIXED: Actually deletes from storage, not just logging
   */
  private async rollbackImages(): Promise<void> {
    if (this.uploadedImageUrls.length === 0) return;

    console.log(
      `[SYNC] Rolling back ${this.uploadedImageUrls.length} uploaded images...`,
    );

    if (!this.supabase) {
      console.error("[SYNC] Cannot rollback: Supabase client not initialized");
      return;
    }

    // Actually delete from storage
    for (const url of this.uploadedImageUrls) {
      try {
        // Extract storage path from URL
        // Format: https://xxx.supabase.co/storage/v1/object/public/listing-images/123/file.jpg
        // Need: 123/file.jpg
        const match = url.match(/\/listing-images\/(.+)$/);
        if (match) {
          const path = match[1];
          const { error } = await this.supabase.storage
            .from("listing-images")
            .remove([path]);

          if (error) {
            console.error(`[SYNC]   Failed to delete ${path}:`, error.message);
          } else {
            console.log(`[SYNC]   Deleted from storage: ${path}`);
          }
        } else {
          console.warn(`[SYNC]   Cannot extract path from URL: ${url}`);
        }
      } catch (error) {
        console.error(`[SYNC]   Error deleting ${url}:`, error);
      }
    }

    this.uploadedImageUrls = [];
  }

  /**
   * Upload pending images and link to listing
   * CRITICAL: Called AFTER listing insert to prevent orphaned images
   */
  private async uploadAndLinkImages(
    listingId: number,
    pendingImages: import("@/types/peekaboo-scraper.types").PendingImage[],
    peekabooId: number,
  ): Promise<number> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized");
    }

    if (pendingImages.length === 0) {
      console.log("[SYNC] No images to upload");
      return 0;
    }

    console.log(
      `[SYNC] Uploading ${pendingImages.length} images for listing ${listingId}...`,
    );

    try {
      const { imageProcessor } = await import("../core/image-processor");
      const { BATCH_CONFIG } = await import("../config");

      const uploadResults: import("@/types/peekaboo-scraper.types").ImageDownloadResult[] =
        [];

      for (
        let i = 0;
        i < pendingImages.length;
        i += BATCH_CONFIG.imagesPerBatch
      ) {
        const batch = pendingImages.slice(i, i + BATCH_CONFIG.imagesPerBatch);
        const urls = batch.map((img) => img.original_url);

        const results = await imageProcessor.processImages(
          urls,
          {
            listingId: peekabooId,
            subFolder: batch[0].subfolder || null,
          },
          BATCH_CONFIG.imagesPerBatch,
        );

        uploadResults.push(...results);
      }

      const successfulUploads = uploadResults.filter(
        (r) => r.success && r.supabaseUrl,
      );

      if (successfulUploads.length === 0) {
        throw new Error("All image uploads failed");
      }

      this.uploadedImageUrls = successfulUploads.map((r) => r.supabaseUrl!);

      const imagesToSync: import("@/types/peekaboo-scraper.types").MappedImage[] =
        successfulUploads.map((result, index) => {
          const pending = pendingImages.find(
            (img) => img.original_url === result.originalUrl,
          );

          return {
            image_url: result.supabaseUrl!,
            display_order: pending?.display_order || index,
            custom_attributes: {
              peekaboo_original_url: result.originalUrl,
              peekaboo_type: pending?.type || "gallery",
            },
          };
        });

      const inserted = await this.syncImages(listingId, imagesToSync);

      console.log(
        `[SYNC] Uploaded and linked ${successfulUploads.length} images`,
      );

      return inserted;
    } catch (error) {
      const uploadError = error as Error;
      console.error("[SYNC] Image upload failed:", uploadError);

      await this.rollbackImages();

      throw new Error(`Image upload failed: ${uploadError.message}`);
    }
  }

  /**
   * Decide what action to take for this listing
   */
  private async decideSyncAction(
    listing: MappedListing,
  ): Promise<SyncDecisionResult> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized");
    }

    const peekabooId = listing.peekaboo_id;

    // Query existing listing by peekaboo_id column
    const { data: existing, error } = await this.supabase
      .from("listings")
      .select("id, updated_at, custom_attributes, status, peekaboo_id")
      .eq("peekaboo_id", peekabooId)
      .maybeSingle();

    if (error) {
      console.error("[SYNC] Error checking existing listing:", error);
      throw new Error(`Failed to check existing listing: ${error.message}`);
    }

    // No existing listing - CREATE
    if (!existing) {
      return {
        action: "create",
        conflicts: [],
        hasManualEdits: false,
      };
    }

    // Existing listing found - check for conflicts
    const conflicts: ConflictInfo[] = [];
    const customAttrs = existing.custom_attributes as Record<string, unknown>;
    const peekabooLastSync = customAttrs?.peekaboo_last_sync as
      | string
      | undefined;

    // Check if listing was manually edited after last sync
    const hasManualEdits =
      peekabooLastSync &&
      new Date(existing.updated_at) > new Date(peekabooLastSync);

    if (this.options.preserveManualEdits && hasManualEdits) {
      return {
        action: "conflict",
        listingId: existing.id,
        conflicts,
        hasManualEdits: true,
      };
    }

    // UPDATE existing listing
    return {
      action: "update",
      listingId: existing.id,
      conflicts,
      hasManualEdits: false,
    };
  }

  /**
   * Upsert listing (insert or update)
   */
  private async upsertListing(
    listing: MappedListing,
    decision: SyncDecisionResult,
  ): Promise<number> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized");
    }

    const now = new Date().toISOString();

    // Add sync timestamp to custom_attributes
    const customAttributes = {
      ...listing.custom_attributes,
      peekaboo_last_sync: now,
    };

    // Prepare listing data - properly typed for Supabase
    const shouldArchiveForMissingCategory =
      this.options.autoPublish && !listing.category_id;

    const listingData: ListingInsert = {
      name: listing.name,
      slug: listing.slug,
      description: listing.description || null,
      address: listing.address || null,
      latitude: listing.latitude || null,
      longitude: listing.longitude || null,
      phone_number: listing.phone_number || null,
      website: listing.website || null,
      peekaboo_id: listing.peekaboo_id,
      email: listing.email || null,
      category_id: listing.category_id || null,
      facebook_url: listing.facebook_url || null,
      instagram_url: listing.instagram_url || null,
      whatsapp_number: listing.whatsapp_number || null,
      youtube_url: listing.youtube_url || null,
      google_maps_url: listing.google_maps_url || null,
      status: shouldArchiveForMissingCategory
        ? "archived"
        : this.options.autoPublish
          ? "published"
          : listing.status,
      is_featured: listing.is_featured,
      show_member_badge: listing.show_member_badge,
      display_order: listing.display_order,
      parking_information: listing.parking_information || null,
      parking_amenities:
        (listing.parking_amenities as Database["public"]["Tables"]["listings"]["Insert"]["parking_amenities"]) ||
        null,
      custom_attributes: customAttributes,
    };

    if (decision.action === "create") {
      const { data, error } = await this.supabase
        .from("listings")
        .insert(listingData)
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: existing, error: fetchErr } = await this.supabase
            .from("listings")
            .select("id")
            .eq("peekaboo_id", listing.peekaboo_id)
            .maybeSingle();

          if (!fetchErr && existing?.id) {
            const { error: updateErr } = await this.supabase
              .from("listings")
              .update(listingData)
              .eq("id", existing.id);

            if (updateErr) {
              throw new Error(
                `Failed to update listing after concurrent insert: ${updateErr.message}`,
              );
            }

            return existing.id;
          }
        }

        throw new Error(`Failed to insert listing: ${error.message}`);
      }

      return data.id;
    } else {
      // UPDATE existing listing
      const { error } = await this.supabase
        .from("listings")
        .update(listingData)
        .eq("id", decision.listingId!);

      if (error) {
        throw new Error(`Failed to update listing: ${error.message}`);
      }

      return decision.listingId!;
    }
  }

  /**
   * Sync branches to listing_branches table
   * Strategy: Delete all existing branches and insert new ones
   * Returns: Map of branch names to their IDs for opening hours sync
   */
  private async syncBranches(
    listingId: number,
    branches: MappedBranch[],
  ): Promise<Map<string | number, number>> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized");
    }

    const branchIdMap = new Map<string | number, number>();

    if (branches.length === 0) {
      return branchIdMap;
    }

    // Step 1: Delete existing branches for this listing
    const { error: deleteError } = await this.supabase
      .from("listing_branches")
      .delete()
      .eq("listing_id", listingId);

    if (deleteError) {
      // CRITICAL: If we cannot delete old branches, we MUST NOT insert new ones to avoid duplicates
      throw new Error(
        `Failed to delete existing branches: ${deleteError.message}`,
      );
    }

    // Step 2: Ensure only ONE primary branch
    let hasPrimary = false;
    const processedBranches = branches.map((branch) => {
      const isPrimary = !hasPrimary && branch.is_primary;
      if (isPrimary) hasPrimary = true;

      return {
        listing_id: listingId,
        name: branch.name,
        address: branch.address,
        city: branch.city,
        country: branch.country,
        latitude: branch.latitude,
        longitude: branch.longitude,
        phone_number: branch.phone_number || null,
        timings: branch.timings || null,
        is_open_now: branch.is_open_now,
        is_primary: isPrimary,
        is_verified: branch.is_verified,
        distance_from_center: branch.distance_from_center || null,
        peekaboo_branch_id: branch.peekaboo_branch_id, // CRITICAL: Include for lookups
        custom_attributes: branch.custom_attributes,
      };
    });

    // If no branch was marked primary, make the first one primary
    if (!hasPrimary && processedBranches.length > 0) {
      processedBranches[0].is_primary = true;
    }

    // Step 3: Insert new branches and get their IDs
    const { data: insertedBranches, error: insertError } = await this.supabase
      .from("listing_branches")
      .insert(processedBranches)
      .select("id, name, peekaboo_branch_id");

    if (insertError) {
      throw new Error(`Failed to insert branches: ${insertError.message}`);
    }

    // Step 4: Build map of peekaboo_branch_id -> database branch ID
    // This map is used by syncOpeningHours to link hours to the correct branch

    if (insertedBranches) {
      insertedBranches.forEach((branch) => {
        // Map by peekaboo_branch_id (primary key for lookups)
        if (branch.peekaboo_branch_id) {
          branchIdMap.set(Number(branch.peekaboo_branch_id), branch.id);
        } else {
          // Fallback: Map by name (for branches without peekaboo_branch_id)
          branchIdMap.set(branch.name, branch.id);
        }
      });

      console.log(`[SYNC] Synced ${insertedBranches.length} branches`);
      console.log(
        `[SYNC] Branch ID map created with ${branchIdMap.size} entries`,
      );
    }

    return branchIdMap;
  }

  /**
   * Sync images to listing_images table
   * Strategy: Smart sync - only add/remove changed images
   * Prevents duplicate uploads and unnecessary storage consumption
   */
  private async syncImages(
    listingId: number,
    images: MappedImage[],
  ): Promise<number> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized");
    }

    // Step 1: Get existing images from database
    const { data: existingImages, error: fetchError } = await this.supabase
      .from("listing_images")
      .select("id, url, display_order, is_primary")
      .eq("listing_id", listingId);

    if (fetchError) {
      console.warn(
        `[SYNC] Warning: Failed to fetch existing images:`,
        fetchError,
      );
    }

    const existingImageUrls = new Set(
      existingImages?.map((img) => img.url) || [],
    );

    // Step 2: Identify new images (not in database)
    const newImages = images.filter(
      (img) => !existingImageUrls.has(img.image_url),
    );

    // Step 3: Identify removed images (in database but not in new set)
    const newImageUrls = new Set(images.map((img) => img.image_url));
    const imagesToDelete = existingImages?.filter(
      (img) => !newImageUrls.has(img.url),
    );

    let changesCount = 0;

    // Step 4: Delete removed images
    if (imagesToDelete && imagesToDelete.length > 0) {
      const idsToDelete = imagesToDelete.map((img) => img.id);
      const { error: deleteError } = await this.supabase
        .from("listing_images")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        console.warn(
          `[SYNC] Warning: Failed to delete removed images:`,
          deleteError,
        );
      } else {
        changesCount += imagesToDelete.length;
        console.log(`[SYNC] Deleted ${imagesToDelete.length} removed images`);
      }
    }

    // Step 5: Insert new images only
    if (newImages.length > 0) {
      // Track new image URLs for rollback
      const newImageUrls = newImages.map((img) => img.image_url);
      this.uploadedImageUrls.push(...newImageUrls);

      // Ensure only ONE primary image across ALL images
      let hasPrimary = existingImages?.some((img) => img.is_primary) || false;

      const imagesToInsert = newImages.map((image, index) => {
        const isPrimary = !hasPrimary && index === 0;
        if (isPrimary) hasPrimary = true;

        return {
          listing_id: listingId,
          url: image.image_url,
          display_order: image.display_order,
          is_primary: isPrimary,
          alt_text: null,
        };
      });

      const { error: insertError } = await this.supabase
        .from("listing_images")
        .insert(imagesToInsert);

      if (insertError) {
        throw new Error(`Failed to insert new images: ${insertError.message}`);
      }

      changesCount += imagesToInsert.length;
      console.log(`[SYNC] Added ${imagesToInsert.length} new images`);
    }

    // Step 6: Update display order and primary flag if images exist but changed
    if (newImages.length === 0 && imagesToDelete?.length === 0) {
      // No structural changes, but verify primary image and display order
      const imageUpdates = images.map((img, index) => ({
        url: img.image_url,
        display_order: img.display_order,
        is_primary: index === 0, // First image is always primary
      }));

      for (const update of imageUpdates) {
        const existing = existingImages?.find((e) => e.url === update.url);
        if (
          existing &&
          (existing.display_order !== update.display_order ||
            existing.is_primary !== update.is_primary)
        ) {
          const { error: updateError } = await this.supabase
            .from("listing_images")
            .update({
              display_order: update.display_order,
              is_primary: update.is_primary,
            })
            .eq("id", existing.id);

          if (updateError) {
            console.warn(
              `[SYNC] Warning: Failed to update image metadata:`,
              updateError,
            );
          }
        }
      }
    }

    if (changesCount === 0) {
      console.log(`[SYNC] Images unchanged (${images.length} existing)`);
    }

    return changesCount;
  }

  /**
   * Sync opening hours from parsed timings
   * Supports both listing-level and branch-specific hours
   *
   * @param listingId - The listing ID
   * @param listing - The mapped listing with timings data
   * @param branches - Array of branches with timings
   * @param branchIdMap - Map of branch names to their database IDs
   */
  private async syncOpeningHours(
    listingId: number,
    listing: MappedListing,
    branches: MappedBranch[],
    branchIdMap?: Map<string | number, number>,
  ): Promise<void> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized");
    }

    // Delete ALL existing opening hours for this listing (including branch-specific)
    const { error: deleteError } = await this.supabase
      .from("opening_hours")
      .delete()
      .eq("listing_id", listingId);

    if (deleteError) {
      // CRITICAL: If we cannot delete old hours, we MUST NOT insert new ones to avoid duplicates
      throw new Error(
        `Failed to clear existing opening hours: ${deleteError.message}`,
      );
    }

    const { openingHoursParser } =
      await import("../transformers/opening-hours-parser");

    let totalHoursInserted = 0;

    // Strategy 1: Use pre-parsed opening_hours from branches if available
    if (branchIdMap && branchIdMap.size > 0 && branches.length > 0) {
      console.log(`[SYNC] === OPENING HOURS SYNC START ===`);
      console.log(`[SYNC] Listing ID: ${listingId}`);
      console.log(`[SYNC] Total branches to process: ${branches.length}`);
      console.log(`[SYNC] Branch ID map size: ${branchIdMap.size}`);
      console.log(`[SYNC] Branch ID map keys:`, Array.from(branchIdMap.keys()));
      console.log(
        `[SYNC] Branch ID map entries:`,
        Array.from(branchIdMap.entries()),
      );

      for (const branch of branches) {
        console.log(`\n[SYNC] --- Processing branch ---`);
        console.log(`[SYNC]   Name: ${branch.name}`);
        console.log(
          `[SYNC]   peekaboo_branch_id: ${branch.peekaboo_branch_id}`,
        );
        console.log(`[SYNC]   Timings: ${branch.timings}`);
        console.log(`[SYNC]   Has opening_hours: ${!!branch.opening_hours}`);
        console.log(
          `[SYNC]   opening_hours length: ${branch.opening_hours?.length || 0}`,
        );

        // Lookup database branch ID using peekaboo_branch_id
        const branchId = branchIdMap.get(Number(branch.peekaboo_branch_id));

        console.log(
          `[SYNC]   Lookup by peekaboo_branch_id ${branch.peekaboo_branch_id}: ${branchId ? `FOUND (db_id=${branchId})` : "NOT FOUND"}`,
        );

        if (!branchId) {
          console.error(
            `[SYNC] CRITICAL: Could not find branch ID for: ${branch.name}`,
          );
          console.error(
            `[SYNC]   peekaboo_branch_id: ${branch.peekaboo_branch_id}`,
          );
          console.error(`[SYNC]   Map size: ${branchIdMap.size}`);
          console.error(
            `[SYNC]   Available map keys:`,
            Array.from(branchIdMap.keys()).slice(0, 10),
          );
          console.error(
            `[SYNC]   SKIPPING THIS BRANCH - NO HOURS WILL BE INSERTED!`,
          );
          continue;
        }

        // Use pre-parsed opening_hours if available, otherwise parse from timings
        const parsedHours: Array<{
          day_of_week: number;
          open_time: string;
          close_time: string;
          is_closed: boolean;
        }> = [];

        console.log(
          `[SYNC] Processing branch: ${branch.name} (peekaboo_branch_id: ${branch.peekaboo_branch_id})`,
        );
        console.log(
          `[SYNC]   - Has opening_hours prop: ${!!branch.opening_hours}`,
        );
        console.log(
          `[SYNC]   - opening_hours length: ${branch.opening_hours?.length || 0}`,
        );

        if (branch.opening_hours && branch.opening_hours.length > 0) {
          // Convert branch opening_hours to the expected format (filter out nulls)
          console.log(
            `[SYNC]   - Using pre-parsed opening_hours (${branch.opening_hours.length} days)`,
          );
          branch.opening_hours.forEach((h) => {
            if (h.open_time && h.close_time) {
              parsedHours.push({
                day_of_week: h.day_of_week,
                open_time: h.open_time,
                close_time: h.close_time,
                is_closed: h.is_closed,
              });
            }
          });
          console.log(
            `[SYNC]   - Filtered to ${parsedHours.length} valid hours`,
          );
        }

        // Fallback: Parse from timings if opening_hours is empty
        if (parsedHours.length === 0) {
          console.log(
            `[SYNC]   - No pre-parsed hours, parsing from timings field`,
          );
          const branchTimings =
            branch.timings || branch.custom_attributes?.peekaboo_timings;
          if (!branchTimings) {
            console.log(
              `[SYNC]   No timings available for branch: ${branch.name}`,
            );
            continue;
          }

          console.log(`[SYNC]   - Parsing timings: "${branchTimings}"`);
          const freshlyParsed = openingHoursParser.parse(
            branchTimings as string,
          );
          console.log(
            `[SYNC]   - Parsed ${freshlyParsed.length} hours from timings`,
          );
          if (freshlyParsed.length === 0) {
            console.log(
              `[SYNC] Could not parse timings for branch ${branch.name}: "${branchTimings}"`,
            );
            continue;
          }

          // Validate and add freshly parsed hours
          const validation = openingHoursParser.validate(freshlyParsed);
          if (!validation.valid) {
            console.warn(
              `[SYNC] Invalid opening hours for branch ${branch.name}:`,
              validation.errors,
            );
            continue;
          }

          parsedHours.push(...freshlyParsed);
        }

        if (parsedHours.length === 0) {
          console.log(`[SYNC]   No valid hours for branch: ${branch.name}`);
          continue;
        }

        console.log(
          `[SYNC]   Ready to insert ${parsedHours.length} hours for branch: ${branch.name}`,
        );
        console.log(`[SYNC]   Sample hours:`, parsedHours.slice(0, 2));

        // Insert branch-specific opening hours WITH branch_id
        const hoursToInsert = parsedHours.map((hour) => ({
          listing_id: listingId,
          branch_id: branchId, // CRITICAL: set branch_id here
          day_of_week: hour.day_of_week,
          open_time: hour.open_time,
          close_time: hour.close_time,
          is_closed: hour.is_closed,
        }));

        const { error: insertError } = await this.supabase
          .from("opening_hours")
          .insert(hoursToInsert);

        if (insertError) {
          console.warn(
            `[SYNC] Warning: Failed to insert branch hours for ${branch.name}:`,
            insertError,
          );
        } else {
          totalHoursInserted += parsedHours.length;
          console.log(
            `[SYNC] Synced ${parsedHours.length} hours for branch: ${branch.name} (branch_id: ${branchId})`,
          );
        }
      }
    }

    // Strategy 2: Fallback to listing-level hours (no branch_id)
    // This applies when there are no branches OR branches don't have timings
    if (totalHoursInserted === 0) {
      const listingTimings = listing.custom_attributes?.peekaboo_timings as
        | string
        | undefined;

      if (!listingTimings) {
        console.log(`[SYNC] No timings data available for opening hours`);
        return;
      }

      const parsedHours = openingHoursParser.parse(listingTimings);
      if (parsedHours.length === 0) {
        console.log(
          `[SYNC] Could not parse listing timings: "${listingTimings}"`,
        );
        return;
      }

      const validation = openingHoursParser.validate(parsedHours);
      if (!validation.valid) {
        console.warn(
          `[SYNC] Invalid listing opening hours:`,
          validation.errors,
        );
        return;
      }

      // Insert listing-level opening hours (branch_id = NULL)
      const hoursToInsert = parsedHours.map((hour) => ({
        listing_id: listingId,
        branch_id: null,
        day_of_week: hour.day_of_week,
        open_time: hour.open_time,
        close_time: hour.close_time,
        is_closed: hour.is_closed,
      }));

      const { error: insertError } = await this.supabase
        .from("opening_hours")
        .insert(hoursToInsert);

      if (insertError) {
        console.warn(
          `[SYNC] Warning: Failed to insert listing hours:`,
          insertError,
        );
      } else {
        totalHoursInserted = parsedHours.length;
        console.log(
          `[SYNC] Synced ${parsedHours.length} listing-level opening hours`,
        );
      }
    }

    if (totalHoursInserted === 0) {
      console.log(`[SYNC] No opening hours synced for listing ${listingId}`);
    }
  }

  /**
   * Get existing listing by Peekaboo ID
   */
  async getExistingListing(peekabooId: number): Promise<{
    id: number;
    name: string;
    status: string;
    updated_at: string;
    custom_attributes: Record<string, unknown>;
  } | null> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized. Call init() first.");
    }

    const { data, error } = await this.supabase
      .from("listings")
      .select("id, name, status, updated_at, custom_attributes, peekaboo_id")
      .eq("peekaboo_id", peekabooId)
      .maybeSingle();

    if (error) {
      console.error("[SYNC] Error fetching existing listing:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Type cast to satisfy return type
    return {
      ...data,
      custom_attributes: data.custom_attributes as Record<string, unknown>,
    };
  }

  /**
   * Get branches for a listing
   */
  async getBranches(listingId: number): Promise<ListingBranch[]> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized. Call init() first.");
    }

    const { data, error } = await this.supabase
      .from("listing_branches")
      .select("*")
      .eq("listing_id", listingId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[SYNC] Error fetching branches:", error);
      return [];
    }

    // Type cast to satisfy return type (handle nullable fields)
    return (
      data?.map((branch) => ({
        ...branch,
        is_open_now: branch.is_open_now ?? false,
        is_primary: branch.is_primary ?? false,
        is_verified: branch.is_verified ?? false,
        custom_attributes: (branch.custom_attributes ||
          {}) as ListingBranch["custom_attributes"],
      })) || []
    );
  }

  /**
   * Normalize bank name for fuzzy matching
   * Removes common variations like "The", "Limited", "Ltd", "Bank", etc.
   */
  private normalizeBankName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(the|limited|ltd|bank|pvt|private)\b/g, "") // Remove common words
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Get bank ID by name (with caching and fuzzy matching)
   * @param bankName - Name of the bank (e.g., "Meezan Bank", "Bank of Punjab")
   * @returns Bank ID or null if not found
   */
  private async getBankId(bankName: string): Promise<number | null> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized. Call init() first.");
    }

    // Check cache first (exact match)
    if (DatabaseSync.bankCache.has(bankName)) {
      return DatabaseSync.bankCache.get(bankName)!;
    }

    // Step 1: Try exact case-insensitive match
    const { data: exactMatch, error: exactError } = await this.supabase
      .from("banks")
      .select("id, name")
      .ilike("name", bankName)
      .maybeSingle();

    if (exactError) {
      console.error(`[SYNC] Error fetching bank "${bankName}":`, exactError);
      return null;
    }

    if (exactMatch) {
      // Cache the result
      DatabaseSync.bankCache.set(bankName, exactMatch.id);
      return exactMatch.id;
    }

    // Step 2: Try fuzzy matching with normalization
    // Get all banks and find the best match
    const { data: allBanks, error: allError } = await this.supabase
      .from("banks")
      .select("id, name")
      .eq("is_active", true);

    if (allError) {
      console.error(`[SYNC] Error fetching banks list:`, allError);
      return null;
    }

    if (!allBanks || allBanks.length === 0) {
      console.warn(`[SYNC] No active banks found in database`);
      return null;
    }

    // Normalize the search term
    const normalizedSearch = this.normalizeBankName(bankName);

    // Find matching bank
    for (const bank of allBanks) {
      const normalizedBank = this.normalizeBankName(bank.name);

      // Check if normalized names match or contain each other
      if (
        normalizedBank === normalizedSearch ||
        normalizedBank.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedBank)
      ) {
        console.log(
          `[SYNC] Fuzzy matched "${bankName}" -> "${bank.name}" (ID: ${bank.id})`,
        );

        // Cache both the original name and the matched name
        DatabaseSync.bankCache.set(bankName, bank.id);
        DatabaseSync.bankCache.set(bank.name, bank.id);

        return bank.id;
      }
    }

    // No match found
    console.warn(`[SYNC] Bank not found in database: "${bankName}"`);
    console.warn(`[SYNC]    Searched for normalized: "${normalizedSearch}"`);
    console.warn(
      `[SYNC]    Consider adding bank manually or via admin interface`,
    );
    return null;
  }

  /**
   * Sync deals (bank/card discounts) to database
   * @param listingId - The listing ID to associate deals with
   * @param deals - Array of Peekaboo deals
   * @returns Number of deals synced
   */
  async syncDeals(
    listingId: number,
    deals: MappedListing["deals"],
  ): Promise<number> {
    if (!this.supabase) {
      throw new Error("DatabaseSync not initialized. Call init() first.");
    }

    if (!deals || deals.length === 0) {
      return 0;
    }

    console.log(
      `[SYNC] Syncing ${deals.length} deals for listing ${listingId}...`,
    );

    let syncedCount = 0;

    for (const deal of deals) {
      try {
        // Get bank ID from cache or database
        const bankId = await this.getBankId(deal.bankName);

        if (!bankId) {
          console.warn(
            `[SYNC] Skipping deal "${deal.title}" - bank "${deal.bankName}" not found`,
          );
          continue;
        }

        // Prepare deal data
        const dealData = {
          listing_id: listingId,
          title: deal.title,
          description: deal.description || null,
          deal_type: "bank_discount" as const, // Matches deal_type enum
          bank_id: bankId,
          discount_value: deal.discountValue, // e.g., "10%", "15%"
          start_date: deal.startDate,
          end_date: deal.endDate,
          is_active: this.isDealActive(deal.startDate, deal.endDate),
          valid_card_variants: deal.validCards, // text[] array
          metadata: {
            peekaboo_deal_id: deal.peekabooId,
            source_entity_id: deal.sourceEntityId,
            percentage_value: deal.percentageValue,
            order_type: deal.orderType,
            online_available: deal.onlineAvailable,
            card_associations: deal.cardAssociations, // Full card details with images
          },
        };

        // Upsert deal (update if exists, insert if new)
        // Use peekaboo_deal_id in metadata as unique identifier
        const { data: existingDeal } = await this.supabase
          .from("deals")
          .select("id")
          .eq("listing_id", listingId)
          .eq("title", deal.title)
          .eq("bank_id", bankId)
          .maybeSingle();

        if (existingDeal) {
          // Update existing deal
          const { error } = await this.supabase
            .from("deals")
            .update(dealData)
            .eq("id", existingDeal.id);

          if (error) {
            console.error(`[SYNC] Error updating deal "${deal.title}":`, error);
            continue;
          }

          console.log(
            `[SYNC]    Updated deal: ${deal.title} (${deal.discountValue})`,
          );
        } else {
          // Insert new deal
          const { error } = await this.supabase.from("deals").insert(dealData);

          if (error) {
            console.error(
              `[SYNC] Error inserting deal "${deal.title}":`,
              error,
            );
            continue;
          }

          console.log(
            `[SYNC]    Created deal: ${deal.title} (${deal.discountValue})`,
          );
        }

        syncedCount++;
      } catch (error) {
        console.error(`[SYNC] Unexpected error syncing deal:`, error);
        continue;
      }
    }

    console.log(`[SYNC] Synced ${syncedCount}/${deals.length} deals`);
    return syncedCount;
  }

  /**
   * Check if a deal is currently active based on dates
   */
  private isDealActive(startDate: string, endDate: string): boolean {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    return now >= start && now <= end;
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Nothing to cleanup currently
    // Future: close connections, release resources
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create and initialize a DatabaseSync instance
 */
export async function createDatabaseSync(
  options?: SyncOptions,
): Promise<DatabaseSync> {
  const sync = new DatabaseSync(options);
  await sync.init();
  return sync;
}
