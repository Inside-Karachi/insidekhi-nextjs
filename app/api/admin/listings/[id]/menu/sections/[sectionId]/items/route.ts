import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

export async function POST(
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
    const {
      name,
      description,
      price,
      is_available = true,
      display_order = 0,
      is_featured = false,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Item name is required" },
        { status: 400 }
      );
    }

    if (typeof price !== "number" || price < 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
        { status: 400 }
      );
    }

    // Check for duplicate item name in the same section
    const { rows: existingRows } = await query(
      `SELECT id FROM menu_items WHERE section_id = $1 AND name = $2 LIMIT 1`,
      [sectionIdNum, name.trim()]
    );

    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "An item with this name already exists in this section" },
        { status: 409 }
      );
    }

    // Create menu item
    let item;
    try {
      const { rows } = await query(
        `INSERT INTO menu_items
           (section_id, name, description, price, is_available, display_order, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          sectionIdNum,
          name.trim(),
          description?.trim() || null,
          price,
          is_available,
          display_order,
          is_featured,
        ]
      );
      item = rows[0];
    } catch (error) {
      console.error("Error creating menu item:", error);
      return NextResponse.json(
        { error: "Failed to create menu item" },
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
    console.error("Error in admin menu item POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
