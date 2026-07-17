import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteFile } from "@/lib/storage/spaces";

/**
 * SUPER ADMIN ONLY: Bulk delete ALL listings
 * DELETE /api/admin/listings/bulk-delete-all
 *
 * This endpoint is specifically for super admins to delete all listings
 * and related data when starting fresh with a new import.
 *
 * It safely handles all foreign key dependencies in the correct order.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 },
      );
    }

    // Get count of listings before deletion
    const { rows: initialCountRows } = await query(
      `SELECT COUNT(*) FROM listings`,
    );
    const initialCount = parseInt(initialCountRows[0].count, 10);

    // CRITICAL: Delete all images from storage FIRST
    console.log(
      "[BULK DELETE ALL] Fetching all listing images from storage...",
    );
    const { rows: allImages } = await query(`SELECT url FROM listing_images`);

    if (allImages && allImages.length > 0) {
      const storageFilesToDelete: string[] = [];
      for (const image of allImages) {
        try {
          const urlParts = image.url.split("/");
          const folderName = urlParts[urlParts.length - 2];
          const fileName = urlParts[urlParts.length - 1];
          storageFilesToDelete.push(`${folderName}/${fileName}`);
        } catch (error) {
          console.error("Error parsing image URL:", error);
        }
      }

      if (storageFilesToDelete.length > 0) {
        console.log(
          `[BULK DELETE ALL] Deleting ${storageFilesToDelete.length} images from storage...`,
        );
        let storageFailures = 0;
        for (const path of storageFilesToDelete) {
          try {
            await deleteFile(path, "listing-images");
          } catch (storageError) {
            storageFailures += 1;
            console.error(
              "[BULK DELETE ALL] Failed to delete storage file:",
              path,
              storageError,
            );
          }
        }
        if (storageFailures === 0) {
          console.log(
            `[BULK DELETE ALL] Successfully deleted ${storageFilesToDelete.length} images`,
          );
        } else {
          console.error(
            `[BULK DELETE ALL] Storage deletion had ${storageFailures} failure(s)`,
          );
        }
      }
    }

    // Delete all related data in correct order (foreign key dependencies)
    const deletionSteps: Array<{
      table: string;
      filter: string | null;
      name: string;
    }> = [
      { table: "events", filter: "listing_id", name: "Events" },
      { table: "reviews", filter: "listing_id", name: "Reviews" },
      { table: "favorite_listings", filter: null, name: "Favorites" },
      { table: "deals", filter: null, name: "Deals" },
      { table: "menu_items", filter: null, name: "Menu Items" },
      { table: "menu_sections", filter: null, name: "Menu Sections" },
      { table: "listing_images", filter: null, name: "Listing Images" },
      { table: "listing_features", filter: null, name: "Listing Features" },
      { table: "opening_hours", filter: null, name: "Opening Hours" },
      { table: "venues", filter: "listing_id", name: "Venues" },
    ];

    // Table/column names below come only from the fixed deletionSteps list
    // above (not user input), so building SQL from them is safe.
    const deletionResults: Record<string, number> = {};

    for (const step of deletionSteps) {
      try {
        const sql = step.filter
          ? `DELETE FROM ${step.table} WHERE ${step.filter} IS NOT NULL`
          : `DELETE FROM ${step.table}`;
        const result = await query(sql);
        deletionResults[step.name] = result.rowCount || 0;
      } catch (error) {
        console.error(`Failed to delete ${step.name}:`, error);
        throw new Error(
          `Failed to delete ${step.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    // Finally, delete all listings
    let listingsDeleted: number;
    try {
      const result = await query(`DELETE FROM listings`);
      listingsDeleted = result.rowCount || 0;
    } catch (error) {
      console.error("Error deleting listings:", error);
      throw new Error(
        `Failed to delete listings: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    deletionResults["Listings"] = listingsDeleted;

    // Log the super admin action
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session.userId,
          "bulk_delete_all_listings",
          "listings",
          "all",
          JSON.stringify({
            initial_count: initialCount,
            deleted_count: listingsDeleted,
            related_deletions: deletionResults,
          }),
          request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown",
          request.headers.get("user-agent") || undefined,
        ],
      );
    } catch (logError) {
      console.error("Failed to log bulk deletion:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      message: "All listings and related data deleted successfully",
      summary: {
        initial_count: initialCount,
        deleted: deletionResults,
      },
    });
  } catch (error) {
    console.error("Bulk delete all error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete all listings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
