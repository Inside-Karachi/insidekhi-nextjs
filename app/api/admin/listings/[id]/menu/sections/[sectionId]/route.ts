import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const { id, sectionId } = await params;
    const listingId = parseInt(id);
    const sectionIdNum = parseInt(sectionId);

    if (isNaN(listingId) || isNaN(sectionIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    const body = await request.json();
    const { name, description, display_order } = body;

    // Prepare update data
    const updateData: {
      name?: string;
      description?: string | null;
      display_order?: number;
    } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (display_order !== undefined) updateData.display_order = display_order;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update menu section
    const { data: section, error } = await supabase
      .from("menu_sections")
      .update(updateData)
      .eq("id", sectionIdNum)
      .eq("listing_id", listingId)
      .select()
      .single();

    if (error) {
      console.error("Error updating menu section:", error);
      return NextResponse.json(
        { error: "Failed to update menu section" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: section,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in admin menu section PATCH:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const { id, sectionId } = await params;
    const listingId = parseInt(id);
    const sectionIdNum = parseInt(sectionId);

    if (isNaN(listingId) || isNaN(sectionIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // Delete menu section (this will cascade to menu items)
    const { error } = await supabase
      .from("menu_sections")
      .delete()
      .eq("id", sectionIdNum)
      .eq("listing_id", listingId);

    if (error) {
      console.error("Error deleting menu section:", error);
      return NextResponse.json(
        { error: "Failed to delete menu section" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Menu section deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in admin menu section DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
