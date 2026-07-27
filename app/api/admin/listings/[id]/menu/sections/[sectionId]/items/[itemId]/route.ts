import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; sectionId: string; itemId: string }> }
) {
  try {
    const { id, sectionId, itemId } = await params;
    const listingId = parseInt(id);
    const sectionIdNum = parseInt(sectionId);
    const itemIdNum = parseInt(itemId);

    if (isNaN(listingId) || isNaN(sectionIdNum) || isNaN(itemIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const body = await request.json();
    const {
      name,
      description,
      price,
      is_available,
      display_order,
      is_featured,
    } = body;

    // Prepare update data
    const updateData: {
      name?: string;
      description?: string | null;
      price?: number;
      is_available?: boolean;
      display_order?: number;
      is_featured?: boolean;
    } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (price !== undefined) updateData.price = price;
    if (is_available !== undefined) updateData.is_available = is_available;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_featured !== undefined) updateData.is_featured = is_featured;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update menu item
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updateData)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
    values.push(itemIdNum, sectionIdNum);

    let item;
    try {
      const { rows } = await query(
        `UPDATE menu_items
         SET ${setClauses.join(", ")}
         WHERE id = $${idx} AND section_id = $${idx + 1}
         RETURNING *`,
        values
      );
      item = rows[0];
    } catch (error) {
      console.error("Error updating menu item:", error);
      return NextResponse.json(
        { error: "Failed to update menu item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in admin menu item PATCH:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; sectionId: string; itemId: string }> }
) {
  try {
    const { id, sectionId, itemId } = await params;
    const listingId = parseInt(id);
    const sectionIdNum = parseInt(sectionId);
    const itemIdNum = parseInt(itemId);

    if (isNaN(listingId) || isNaN(sectionIdNum) || isNaN(itemIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Delete menu item
    try {
      await query(
        `DELETE FROM menu_items WHERE id = $1 AND section_id = $2`,
        [itemIdNum, sectionIdNum]
      );
    } catch (error) {
      console.error("Error deleting menu item:", error);
      return NextResponse.json(
        { error: "Failed to delete menu item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in admin menu item DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
