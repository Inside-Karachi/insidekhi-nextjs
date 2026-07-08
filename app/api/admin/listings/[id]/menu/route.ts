import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // Get menu sections with items
    const { data: menuSections, error } = await supabase
      .from("menu_sections")
      .select(
        `
        *,
        menu_items (
          *,
          id,
          name,
          description,
          price,
          is_available,
          display_order
        )
      `
      )
      .eq("listing_id", listingId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching menu:", error);
      return NextResponse.json(
        { error: "Failed to fetch menu" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: menuSections || [],
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in admin menu GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    const body = await request.json();
    const { name, description, display_order = 0 } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Section name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate section name in the same listing
    const { data: existingSection, error: checkError } = await supabase
      .from("menu_sections")
      .select("id")
      .eq("listing_id", listingId)
      .eq("name", name.trim())
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking for duplicate section:", checkError);
      return NextResponse.json(
        { error: "Failed to validate section" },
        { status: 500 }
      );
    }

    if (existingSection) {
      return NextResponse.json(
        { error: "A section with this name already exists in this menu" },
        { status: 409 }
      );
    }

    // Create menu section
    const { data: section, error } = await supabase
      .from("menu_sections")
      .insert({
        listing_id: listingId,
        name: name.trim(),
        description: description?.trim() || null,
        display_order,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating menu section:", error);
      return NextResponse.json(
        { error: "Failed to create menu section" },
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
    console.error("Error in admin menu POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
