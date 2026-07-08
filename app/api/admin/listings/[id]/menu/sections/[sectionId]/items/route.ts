import { NextRequest, NextResponse } from "next/server";
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

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

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
    const { data: existingItem, error: checkError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("section_id", sectionIdNum)
      .eq("name", name.trim())
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking for duplicate item:", checkError);
      return NextResponse.json(
        { error: "Failed to validate item" },
        { status: 500 }
      );
    }

    if (existingItem) {
      return NextResponse.json(
        { error: "An item with this name already exists in this section" },
        { status: 409 }
      );
    }

    // Create menu item
    const { data: item, error } = await supabase
      .from("menu_items")
      .insert({
        section_id: sectionIdNum,
        name: name.trim(),
        description: description?.trim() || null,
        price,
        is_available,
        display_order,
        is_featured,
      })
      .select()
      .single();

    if (error) {
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
