import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  getSupabaseClientForRole,
} from "@/lib/supabase/server";
import { deleteListingsBulk } from "@/lib/utils/listing-deletion";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const categoryId = searchParams.get("category_id") || "";

    const offset = (page - 1) * limit;

    let query = adminSupabase
      .from("listings")
      .select(
        "*, creator:profiles!listings_created_by_fkey(id,full_name), category:categories(id,name)",
        {
          count: "exact",
        },
      );

    // Apply search filter first (search across name and description)
    if (search) {
      // Important: Use parentheses to group the OR condition
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply other filters (these use AND logic with search if search exists)
    if (status && status !== "all") {
      query = query.eq(
        "status",
        status as
          | "draft"
          | "published"
          | "archived"
          | "pending_approval"
          | "rejected",
      );
    }

    if (categoryId && categoryId !== "all") {
      const categoryIdNum = parseInt(categoryId);
      if (!isNaN(categoryIdNum)) {
        query = query.eq("category_id", categoryIdNum);
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Order by creation date (newest first)
    query = query.order("created_at", { ascending: false });

    const { data: listings, error, count } = await query;

    if (error) {
      console.error("Error fetching listings:", error);
      return NextResponse.json(
        { error: "Failed to fetch listings" },
        { status: 500 },
      );
    }

    // Get accurate stats counts using database count queries
    const [
      { count: totalCount },
      { count: publishedCount },
      { count: draftCount },
      { count: featuredCount },
      { count: archivedCount },
    ] = await Promise.all([
      // Total listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true }),

      // Published listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),

      // Draft listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft"),

      // Featured listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("is_featured", true),

      // Archived listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "archived"),
    ]);

    const stats = {
      total: totalCount || 0,
      published: publishedCount || 0,
      draft: draftCount || 0,
      featured: featuredCount || 0,
      archived: archivedCount || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        listings: (listings || []).map((l) => {
          let creator_full_name = null;
          if (
            l.creator &&
            typeof l.creator === "object" &&
            "full_name" in l.creator
          ) {
            creator_full_name =
              (l.creator as { full_name?: string }).full_name || null;
          }

          let category_name = null;
          if (
            l.category &&
            typeof l.category === "object" &&
            "name" in l.category
          ) {
            category_name = (l.category as { name?: string }).name || null;
          }

          return {
            ...l,
            creator_full_name,
            category_name,
          };
        }),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        stats,
        currentUser: {
          id: user.id,
          full_name: profile.full_name || user.email || "Staff",
          role: profile.role,
        },
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const body = await request.json();
    const {
      name,
      description,
      address,
      phone_number,
      email,
      website,
      category_id,
      latitude,
      longitude,
      is_featured,
      status,
      facebook_url,
      instagram_url,
      whatsapp_number,
      youtube_url,
      google_maps_url,
      place_id,
      owner_id, // allow owner_id to be set explicitly, but do not default
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Listing name is required" },
        { status: 400 },
      );
    }

    if (!category_id) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 },
      );
    }

    // Generate slug from name
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Insert new listing
    const { data: listing, error } = await adminSupabase
      .from("listings")
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        address: address?.trim() || null,
        phone_number: phone_number?.trim() || null,
        email: email?.trim() || null,
        website: website?.trim() || null,
        category_id: parseInt(category_id),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        is_featured: is_featured || false,
        status: status || "draft",
        owner_id: owner_id || null,
        created_by: user.id,
        facebook_url: facebook_url?.trim() || null,
        instagram_url: instagram_url?.trim() || null,
        whatsapp_number: whatsapp_number?.trim() || null,
        youtube_url: youtube_url?.trim() || null,
        google_maps_url: google_maps_url?.trim() || null,
        place_id: place_id?.trim() || null,
        parking_information: body.parking_information?.trim() || null,
        parking_amenities: body.parking_amenities || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating listing:", error);
      return NextResponse.json(
        { error: "Failed to create listing" },
        { status: 500 },
      );
    }

    // Log the admin action
    try {
      const { logListingCreation } = await import("@/lib/audit");
      await logListingCreation(
        user.id,
        listing.id.toString(),
        listing,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log listing creation:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json(
      { success: true, data: { listing } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    if (![
      "admin",
      "super_admin",
      "lister",
    ].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const adminSupabase = await getSupabaseClientForRole(profile.role);
    const body = await request.json();
    const { ids, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: ids array is required" },
        { status: 400 },
      );
    }

    const validIds = ids.filter((id) => typeof id === "number" && !isNaN(id));
    if (validIds.length !== ids.length) {
      return NextResponse.json(
        { error: "Invalid request: all ids must be valid numbers" },
        { status: 400 },
      );
    }

    const allowedStatuses = ["published", "draft"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid request: status must be 'published' or 'draft'" },
        { status: 400 },
      );
    }

    const { data: existingListings, error: fetchError } = await adminSupabase
      .from("listings")
      .select("*")
      .in("id", validIds);

    if (fetchError) {
      console.error("Error fetching listings for bulk status update:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch listings for update" },
        { status: 500 },
      );
    }

    if (!existingListings || existingListings.length === 0) {
      return NextResponse.json(
        { error: "No listings found for provided ids" },
        { status: 404 },
      );
    }

    const { data: updatedListings, error: updateError } = await adminSupabase
      .from("listings")
      .update({ status })
      .in("id", validIds)
      .select("id, status");

    if (updateError) {
      console.error("Error bulk updating listing status:", updateError);
      return NextResponse.json(
        { error: "Failed to update listing status" },
        { status: 500 },
      );
    }

    try {
      const { logListingUpdate } = await import("@/lib/audit");
      for (const listing of existingListings) {
        await logListingUpdate(
          user.id,
          listing.id.toString(),
          listing,
          {
            ...listing,
            status,
          },
          request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown",
          request.headers.get("user-agent") || undefined,
        );
      }
    } catch (logError) {
      console.error("Failed to log bulk listing status updates:", logError);
    }

    return NextResponse.json({
      success: true,
      message: `${updatedListings?.length || 0} listing(s) moved to ${status}`,
      updatedCount: updatedListings?.length || 0,
      status,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: ids array is required" },
        { status: 400 },
      );
    }

    // Validate all IDs are numbers
    const validIds = ids.filter((id) => typeof id === "number" && !isNaN(id));
    if (validIds.length !== ids.length) {
      return NextResponse.json(
        { error: "Invalid request: all ids must be valid numbers" },
        { status: 400 },
      );
    }

    // Get listing data before deletion for logging
    const { data: listingsToDelete, error: fetchError } = await adminSupabase
      .from("listings")
      .select("*")
      .in("id", validIds);

    if (fetchError) {
      console.error("Error fetching listings for deletion:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch listings for deletion" },
        { status: 500 },
      );
    }

    // Use service role for storage operations
    const serviceRoleClient = await createServerSupabase({
      useServiceRole: true,
    });

    // Use centralized deletion utility
    const deletionResult = await deleteListingsBulk(
      serviceRoleClient,
      validIds,
    );

    if (!deletionResult.success) {
      // Check if partial success (some deleted, some blocked)
      if (deletionResult.deletedCount && deletionResult.deletedCount > 0) {
        console.warn(
          `[BULK DELETE] Partial success: ${deletionResult.deletedCount} deleted, ${deletionResult.failedIds?.length || 0} failed`,
        );
        // Continue to logging for successfully deleted ones
      } else {
        return NextResponse.json(
          {
            error: deletionResult.error || "Failed to delete listings",
            details: deletionResult.restrictionErrors,
          },
          { status: 400 },
        );
      }
    }

    const successfullyDeletedIds = deletionResult.failedIds
      ? validIds.filter((id) => !deletionResult.failedIds!.includes(id))
      : validIds;

    // Log the admin actions for successfully deleted listings
    try {
      const { logListingDeletion } = await import("@/lib/audit");
      for (const listing of listingsToDelete || []) {
        if (successfullyDeletedIds.includes(listing.id)) {
          await logListingDeletion(
            user.id,
            listing.id.toString(),
            listing,
            request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              "unknown",
            request.headers.get("user-agent") || undefined,
          );
        }
      }
    } catch (logError) {
      console.error("Failed to log listing deletions:", logError);
    }

    const responseMessage = deletionResult.failedIds?.length
      ? `${deletionResult.deletedCount} listing(s) deleted. ${deletionResult.failedIds.length} skipped due to active change requests.`
      : `${deletionResult.deletedCount} listing(s) deleted successfully`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      deletedCount: deletionResult.deletedCount,
      failedCount: deletionResult.failedIds?.length || 0,
      failedIds: deletionResult.failedIds,
      warnings: deletionResult.restrictionErrors,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
