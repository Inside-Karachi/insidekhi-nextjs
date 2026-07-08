import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 },
      );
    }

    // Use service role client to bypass RLS
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get count of listings before deletion
    const { count: initialCount } = await adminSupabase
      .from("listings")
      .select("*", { count: "exact", head: true });

    // CRITICAL: Delete all images from storage FIRST
    console.log(
      "[BULK DELETE ALL] Fetching all listing images from storage...",
    );
    const { data: allImages } = await adminSupabase
      .from("listing_images")
      .select("url");

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
        const { error: storageError } = await adminSupabase.storage
          .from("listing-images")
          .remove(storageFilesToDelete);

        if (storageError) {
          console.error(
            "[BULK DELETE ALL] Storage deletion failed:",
            storageError,
          );
        } else {
          console.log(
            `[BULK DELETE ALL] Successfully deleted ${storageFilesToDelete.length} images`,
          );
        }
      }
    }

    // Delete all related data in correct order (foreign key dependencies)
    const deletionSteps = [
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

    const deletionResults: Record<string, number> = {};

    // Delete related data
    for (const step of deletionSteps) {
      try {
        // Use type assertion since we're dynamically accessing tables
        const { error, count } = await (step.filter
          ? (
              adminSupabase.from as (
                table: string,
              ) => ReturnType<typeof adminSupabase.from>
            )(step.table)
              .delete()
              .not(step.filter, "is", null)
          : (
              adminSupabase.from as (
                table: string,
              ) => ReturnType<typeof adminSupabase.from>
            )(step.table)
              .delete()
              .neq("id", 0));

        if (error) {
          console.error(`Error deleting ${step.name}:`, error);
          throw new Error(`Failed to delete ${step.name}: ${error.message}`);
        }

        deletionResults[step.name] = count || 0;
      } catch (error) {
        console.error(`Failed to delete ${step.name}:`, error);
        throw error;
      }
    }

    // Finally, delete all listings
    const { error: listingsError, count: listingsDeleted } = await adminSupabase
      .from("listings")
      .delete()
      .neq("id", 0); // Delete all (id != 0 means all)

    if (listingsError) {
      console.error("Error deleting listings:", listingsError);
      throw new Error(`Failed to delete listings: ${listingsError.message}`);
    }

    deletionResults["Listings"] = listingsDeleted || 0;

    // Log the super admin action
    try {
      await adminSupabase.from("audit_logs").insert({
        user_id: user.id,
        action: "bulk_delete_all_listings",
        entity_type: "listings",
        entity_id: "all",
        details: {
          initial_count: initialCount,
          deleted_count: listingsDeleted,
          related_deletions: deletionResults,
        },
        ip_address:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        user_agent: request.headers.get("user-agent") || undefined,
      });
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
