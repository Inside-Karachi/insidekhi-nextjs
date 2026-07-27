import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

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
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updateData)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
    values.push(sectionIdNum, listingId);

    let section;
    try {
      const { rows } = await query(
        `UPDATE menu_sections
         SET ${setClauses.join(", ")}
         WHERE id = $${idx} AND listing_id = $${idx + 1}
         RETURNING *`,
        values
      );
      section = rows[0];
    } catch (error) {
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

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Delete menu section (this will cascade to menu items)
    try {
      await query(
        `DELETE FROM menu_sections WHERE id = $1 AND listing_id = $2`,
        [sectionIdNum, listingId]
      );
    } catch (error) {
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
