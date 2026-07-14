import { query } from "@/lib/db";
import { deleteFile } from "@/lib/storage/spaces";

interface StorageFile {
  bucket: string;
  path: string;
}

interface DeletionResult {
  success: boolean;
  error?: string;
  deletedCount?: number;
  failedIds?: number[];
  restrictionErrors?: string[];
}

/**
 * Extract storage path from Supabase URL
 */
function extractStoragePath(url: string, bucketName: string): string | null {
  try {
    const bucketMarker = `/storage/v1/object/public/${bucketName}/`;
    const markerIndex = url.indexOf(bucketMarker);

    if (markerIndex === -1) return null;

    const filePath = url.substring(markerIndex + bucketMarker.length);
    return filePath || null;
  } catch {
    return null;
  }
}

/**
 * Check for RESTRICT constraints that would block deletion
 * Returns array of listing IDs that have blocking constraints
 */
async function checkRestrictConstraints(
  listingIds: number[],
): Promise<{ blockedIds: number[]; errors: string[] }> {
  const blockedIds: number[] = [];
  const errors: string[] = [];

  // Check listing_change_requests (has RESTRICT constraint)
  try {
    const { rows: changeRequests } = await query(
      `SELECT listing_id, status FROM listing_change_requests WHERE listing_id = ANY($1::int[])`,
      [listingIds],
    );

    if (changeRequests.length > 0) {
      const uniqueBlockedIds = [
        ...new Set(changeRequests.map((cr) => cr.listing_id)),
      ];
      blockedIds.push(...uniqueBlockedIds);
      errors.push(
        `Cannot delete ${uniqueBlockedIds.length} listing(s) with active change requests. Delete change requests first.`,
      );
    }
  } catch (error) {
    console.error("Error checking change requests:", error);
    errors.push("Failed to validate change requests");
  }

  return { blockedIds, errors };
}

/**
 * Collect all storage files to delete for given listings
 */
async function collectStorageFiles(
  listingIds: number[],
): Promise<StorageFile[]> {
  const filesToDelete: StorageFile[] = [];

  // 1. Listing images - CASCADE + trigger will handle table deletion
  // We don't need to manually delete from bucket (trigger does it)
  // But we fetch for logging purposes
  const { rows: listingImages } = await query(
    `SELECT url, listing_id FROM listing_images WHERE listing_id = ANY($1::int[])`,
    [listingIds],
  );

  if (listingImages.length > 0) {
    console.log(
      `[DELETE] Found ${listingImages.length} listing images (trigger will handle cleanup)`,
    );
  }

  // 2. Menu PDFs - NOT handled by trigger
  const { rows: listings } = await query(
    `SELECT id, menu_pdf_url FROM listings WHERE id = ANY($1::int[]) AND menu_pdf_url IS NOT NULL`,
    [listingIds],
  );

  for (const listing of listings) {
    if (listing.menu_pdf_url) {
      const path = extractStoragePath(listing.menu_pdf_url, "menu-pdfs");
      if (path) {
        filesToDelete.push({ bucket: "menu-pdfs", path });
      }
    }
  }

  // 3. Menu item images - NOT handled by trigger
  // menu_items -> menu_sections -> listings (CASCADE chain)
  const { rows: menuItems } = await query(
    `SELECT mi.id, mi.image_url
     FROM menu_items mi
     JOIN menu_sections ms ON ms.id = mi.section_id
     WHERE ms.listing_id = ANY($1::int[]) AND mi.image_url IS NOT NULL`,
    [listingIds],
  );

  for (const item of menuItems) {
    if (item.image_url) {
      const path = extractStoragePath(item.image_url, "menu-item-images");
      if (path) {
        filesToDelete.push({ bucket: "menu-item-images", path });
      }
    }
  }

  return filesToDelete;
}

/**
 * Delete files from storage buckets
 */
async function deleteStorageFiles(files: StorageFile[]): Promise<void> {
  for (const file of files) {
    console.log(`[DELETE] Removing file ${file.path} from bucket ${file.bucket}`);
    try {
      // In DigitalOcean Spaces, we target folders as prefixes or distinct custom path structures.
      // We pass the bucket and path to our custom delete utility.
      await deleteFile(file.path, file.bucket);
    } catch (error) {
      console.error(`[DELETE] Failed to delete file ${file.path} from bucket ${file.bucket}:`, error);
    }
  }
}

/**
 * Delete single listing with all associated data
 */
export async function deleteListing(listingId: number): Promise<DeletionResult> {
  try {
    // Check RESTRICT constraints
    const { blockedIds, errors } = await checkRestrictConstraints([listingId]);

    if (blockedIds.length > 0) {
      return {
        success: false,
        error: errors[0] || "Listing has active change requests",
        restrictionErrors: errors,
      };
    }

    // Collect storage files (excluding listing_images - trigger handles those)
    const filesToDelete = await collectStorageFiles([listingId]);

    // Delete storage files
    if (filesToDelete.length > 0) {
      await deleteStorageFiles(filesToDelete);
    }

    // Delete listing - CASCADE will handle related tables
    // listing_images trigger will handle storage cleanup
    try {
      await query(`DELETE FROM listings WHERE id = $1`, [listingId]);
    } catch (deleteError) {
      console.error("[DELETE] Failed to delete listing:", deleteError);
      return {
        success: false,
        error: "Failed to delete listing from database",
      };
    }

    console.log(`[DELETE] Successfully deleted listing ${listingId}`);

    return {
      success: true,
      deletedCount: 1,
    };
  } catch (error) {
    console.error("[DELETE] Unexpected error:", error);
    return {
      success: false,
      error: "Internal server error",
    };
  }
}

/**
 * Bulk delete listings with all associated data
 */
export async function deleteListingsBulk(
  listingIds: number[],
): Promise<DeletionResult> {
  try {
    if (listingIds.length === 0) {
      return { success: false, error: "No listing IDs provided" };
    }

    // Check RESTRICT constraints
    const { blockedIds, errors } = await checkRestrictConstraints(listingIds);

    if (blockedIds.length > 0) {
      // Filter out blocked IDs
      const allowedIds = listingIds.filter((id) => !blockedIds.includes(id));

      if (allowedIds.length === 0) {
        return {
          success: false,
          error: "All listings have active change requests",
          restrictionErrors: errors,
          failedIds: blockedIds,
        };
      }

      console.warn(
        `[DELETE] Skipping ${blockedIds.length} listings with change requests`,
      );
      console.warn(`[DELETE] Proceeding with ${allowedIds.length} listings`);

      // Continue with allowed IDs
      listingIds = allowedIds;
    }

    // Collect storage files (excluding listing_images)
    const filesToDelete = await collectStorageFiles(listingIds);

    // Delete storage files
    if (filesToDelete.length > 0) {
      await deleteStorageFiles(filesToDelete);
    }

    // Delete listings - CASCADE handles tables, trigger handles listing_images
    try {
      await query(`DELETE FROM listings WHERE id = ANY($1::int[])`, [listingIds]);
    } catch (deleteError) {
      console.error("[DELETE] Failed to delete listings:", deleteError);
      return {
        success: false,
        error: "Failed to delete listings from database",
      };
    }

    console.log(`[DELETE] Successfully deleted ${listingIds.length} listings`);

    return {
      success: true,
      deletedCount: listingIds.length,
      failedIds: blockedIds.length > 0 ? blockedIds : undefined,
      restrictionErrors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("[DELETE] Unexpected error:", error);
    return {
      success: false,
      error: "Internal server error",
    };
  }
}
