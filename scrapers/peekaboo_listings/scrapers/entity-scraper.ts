/**
 * ENTITY SCRAPER
 * Fetches and processes entity listings from Peekaboo
 */

import type {
  PeekabooEntity,
  PeekabooBranch,
  PeekabooDeal,
  MappedListing,
  MappedBranch,
  PendingImage,
  MappedDeal,
  ScraperContext,
} from "@/types/peekaboo-scraper.types";
import { PeekabooAPIClient } from "../core/api-client";
import { fieldMapper } from "../transformers/field-mapper";
import { categoryMapper } from "../transformers/category-mapper";

export interface ProcessedEntity {
  listing: MappedListing;
  branches: MappedBranch[];
  pendingImages: PendingImage[]; // Changed: Return pending images, not uploaded
  deals: MappedDeal[];
  rawEntity: PeekabooEntity;
  rawBranches: PeekabooBranch[];
  rawDeals: PeekabooDeal[];
}

export interface EntityListFetchWarning {
  type: "source-pagination-cap" | "source-fetch-error";
  message: string;
  failedOffset: number;
  fetchedCount: number;
}

export class EntityScraper {
  private entityListFetchWarning: EntityListFetchWarning | null = null;

  constructor(
    private client: PeekabooAPIClient,
    private context: ScraperContext,
  ) {}

  /**
   * Get all entity IDs from Peekaboo
   */
  async getAllEntityIds(): Promise<Array<{ id: number; slug: string }>> {
    console.log("[SCRAPER] Fetching all entity IDs...");

    this.entityListFetchWarning = null;

    const allEntities: Array<{ id: number; slug: string }> = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.getAllEntities(offset, limit);

        if (!response.entities || response.entities.length === 0) {
          hasMore = false;
          break;
        }

        allEntities.push(
          ...response.entities.map((e) => ({
            id: e.id,
            slug: e.slug,
          })),
        );

        console.log(
          `[SCRAPER] Fetched ${allEntities.length} entities so far...`,
        );

        offset += limit;

        // If we got fewer results than the limit, we've reached the end
        if (response.entities.length < limit) {
          hasMore = false;
        }
      } catch (error) {
        const fetchError = error as Error;
        console.error("[SCRAPER] Error fetching entities:", fetchError.message);

        if (offset >= 10000) {
          this.entityListFetchWarning = {
            type: "source-pagination-cap",
            message: `Source API returned ${fetchError.message} at offset ${offset}.`,
            failedOffset: offset,
            fetchedCount: allEntities.length,
          };
        } else {
          this.entityListFetchWarning = {
            type: "source-fetch-error",
            message: `Source API returned ${fetchError.message} at offset ${offset}.`,
            failedOffset: offset,
            fetchedCount: allEntities.length,
          };
        }

        hasMore = false;
      }
    }

    if (this.entityListFetchWarning?.type === "source-pagination-cap") {
      console.warn("[SCRAPER] Attempting fallback discovery...");
      await this.discoverEntitiesByQueryShards(allEntities);

      this.entityListFetchWarning.message = `${this.entityListFetchWarning.message} Fallback recovered total discovered entities to ${allEntities.length}.`;
    }

    console.log(`[SCRAPER] Total entities found: ${allEntities.length}`);
    return allEntities;
  }

  getEntityListFetchWarning(): EntityListFetchWarning | null {
    return this.entityListFetchWarning;
  }

  private async discoverEntitiesByQueryShards(
    sink: Array<{ id: number; slug: string }>,
  ): Promise<void> {
    const shardKeys = [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      ..."abcdefghijklmnopqrstuvwxyz".split(""),
    ];

    const existingIds = new Set(sink.map((e) => e.id));
    const limit = 100;

    for (const query of shardKeys) {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.client.getEntitiesByQuery(
            query,
            offset,
            limit,
          );

          if (!response.entities || response.entities.length === 0) {
            break;
          }

          let addedInPage = 0;
          for (const entity of response.entities) {
            if (!existingIds.has(entity.id)) {
              existingIds.add(entity.id);
              sink.push({ id: entity.id, slug: entity.slug });
              addedInPage++;
            }
          }

          console.log(
            `[SCRAPER][FALLBACK:${query}] offset=${offset} page=${response.entities.length} added=${addedInPage} totalUnique=${sink.length}`,
          );

          offset += limit;

          const maybeNextPage = (response as unknown as { nextPage?: unknown })
            .nextPage;
          const hasNextFlag = maybeNextPage === true;
          if (response.entities.length < limit || !hasNextFlag) {
            hasMore = false;
          }
        } catch (error) {
          const shardError = error as Error;
          console.warn(
            `[SCRAPER][FALLBACK:${query}] stopped at offset=${offset}: ${shardError.message}`,
          );
          hasMore = false;
        }
      }
    }
  }

  /**
   * Process single entity: fetch details, branches, and transform data
   */
  async processEntity(
    entityId: number,
    slug: string,
  ): Promise<ProcessedEntity> {
    console.log(`\n[SCRAPER] Processing entity: ${slug} (ID: ${entityId})`);

    try {
      // OPTIMIZATION: Fetch entity details, branches, and deals in parallel
      const [detailResponse, branchesResponse, dealsResponse] =
        await Promise.allSettled([
          this.client.getEntityDetail(entityId, slug),
          this.client.getEntityBranches(entityId),
          this.client.getEntityDeals(entityId), // Fetch deals in parallel!
        ]);

      // Handle entity details (required)
      if (detailResponse.status === "rejected") {
        throw new Error(
          `Failed to fetch entity details: ${detailResponse.reason}`,
        );
      }

      const entity =
        detailResponse.value.entity ||
        (detailResponse.value as unknown as PeekabooEntity);

      if (!entity || !entity.name) {
        throw new Error(`Entity ${entityId} has no valid data in API response`);
      }

      // Handle branches (optional - might not exist)
      let branchesData: PeekabooBranch[] = [];
      if (branchesResponse.status === "fulfilled") {
        branchesData = branchesResponse.value.branches || [];
        console.log(`[SCRAPER] Found ${branchesData.length} branches`);
      } else {
        console.warn(`[SCRAPER] No branches found or fetch failed (this is OK)`);
      }

      // Find primary branch (use first verified or just first branch)
      const primaryBranch =
        branchesData.find((b) => b.isVerified === 1) || branchesData[0];

      // Map to listing
      const listing = fieldMapper.mapToListing(entity, primaryBranch);

      // Explicitly set peekaboo_id from the source argument to ensure it is never null/undefined
      listing.peekaboo_id = entityId;

      // Map category from tags
      if (entity.tags && entity.tags.length > 0) {
        const tagStrings = entity.tags.map((t) => t.tag);
        const categoryResult = categoryMapper.mapTags(tagStrings);
        listing.category_id = categoryResult.categoryId;

        console.log(`[SCRAPER] Tags: ${tagStrings.join(", ")}`);
        console.log(
          `[SCRAPER] Category: ${categoryResult.categoryId || "None"} (${
            categoryResult.confidence
          })`,
        );
      }

      // Validate listing
      const validation = fieldMapper.validateListing(listing);
      if (!validation.valid) {
        console.warn(`[SCRAPER]   Validation warnings:`, validation.errors);
      }

      // Map branches from Peekaboo branch data
      const branches: MappedBranch[] = [];
      for (const branch of branchesData) {
        const mappedBranch = fieldMapper.mapToBranch(branch, 0); // listingId will be set later
        const branchValidation = fieldMapper.validateBranch(mappedBranch);

        if (branchValidation.valid) {
          branches.push(mappedBranch);
        } else {
          console.warn(
            `[SCRAPER]   Skipping invalid branch: ${branch.name}`,
            branchValidation.errors,
          );
        }
      }

      // Collect image metadata (DON'T upload yet - deferred until after listing insert)
      const pendingImages: PendingImage[] = [];
      const extractedImages = fieldMapper.extractImages(entity.richContent);

      if (extractedImages.length > 0) {
        console.log(
          `[SCRAPER] Found ${extractedImages.length} images to process after listing insert`,
        );

        // Build pending image list with metadata
        extractedImages.forEach((img, index) => {
          // Determine subfolder based on type
          let subfolder: "menu" | "logo" | null = null;
          if (img.type === "menu") subfolder = "menu";
          else if (img.type === "logo") subfolder = "logo";

          // Skip logos from listing_images table (stored in custom_attributes instead)
          if (img.type === "logo") return;

          pendingImages.push({
            original_url: img.url,
            type: img.type || (index === 0 ? "cover" : "gallery"),
            display_order: index,
            subfolder,
          });
        });

        console.log(
          `[SCRAPER] Prepared ${pendingImages.length} images for upload (Logos excluded)`,
        );
      }

      // Update stats
      this.context.stats.entitiesProcessed++;
      this.context.stats.branchesSynced += branches.length;
      // Note: imagesSynced will be updated in database-sync after upload

      // Process deals (bank/card discounts)
      let deals: MappedDeal[] = [];
      let dealsData: PeekabooDeal[] = [];

      if (dealsResponse.status === "fulfilled") {
        dealsData = dealsResponse.value.deals || [];
        console.log(`[SCRAPER] Found ${dealsData.length} bank deals`);

        // Map Peekaboo deals to database format
        deals = dealsData.map((deal) => ({
          peekabooId: deal.dealId,
          title: deal.title,
          description: deal.description || null,
          bankName: deal.sourceEntityName, // "Meezan Bank"
          sourceEntityId: deal.sourceEntityId, // Bank's Peekaboo ID
          discountValue: `${deal.percentageValue || 0}%`, // "10%", "15%"
          percentageValue: deal.percentageValue,
          startDate: deal.startDate,
          endDate: deal.endDate,
          validCards: deal.associations.map((assoc) => assoc.typeId), // Use typeId (number[]) instead of name
          cardAssociations: deal.associations.map((assoc) => ({
            typeId: assoc.typeId,
            name: assoc.name,
            image: assoc.image,
            order: assoc.order,
          })),
          orderType: deal.orderType,
          onlineAvailable: deal.onlineAvailable,
        }));

        console.log(`[SCRAPER] Mapped ${deals.length} deals for sync`);
      } else {
        console.log(`[SCRAPER] No deals found or fetch failed (this is OK)`);
      }

      console.log(`[SCRAPER] Entity processed successfully`);

      return {
        listing,
        branches,
        pendingImages,
        deals,
        rawEntity: entity,
        rawBranches: branchesData,
        rawDeals: dealsData,
      };
    } catch (error) {
      this.context.stats.errors++;
      const procError = error as Error;
      console.error(
        `[SCRAPER] Failed to process entity ${entityId}:`,
        procError.message,
      );
      throw procError;
    }
  }

  /**
   * Process multiple entities in batches
   */
  async *processBatch(
    entityIds: Array<{ id: number; slug: string }>,
  ): AsyncGenerator<ProcessedEntity, void, unknown> {
    console.log(`\n[SCRAPER] Processing ${entityIds.length} entities...`);

    for (let i = 0; i < entityIds.length; i++) {
      const entity = entityIds[i];

      try {
        const processed = await this.processEntity(entity.id, entity.slug);
        yield processed;
      } catch (error) {
        const batchError = error as Error;
        console.error(
          `[SCRAPER] Skipping entity ${entity.id} due to error:`,
          batchError.message,
        );
        continue;
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(
          `\n[SCRAPER] Progress: ${i + 1}/${
            entityIds.length
          } entities processed`,
        );
      }
    }

    console.log(`\n[SCRAPER] Batch processing complete`);
  }
}
