import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { Database } from "@/types/supabase";

type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];
type DealUpdate = Database["public"]["Tables"]["deals"]["Update"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    // Get deals for the listing
    const { data: deals, error } = await supabase
      .from("deals")
      .select(
        `
        *,
        banks (
          id,
          name,
          logo_url
        )
      `
      )
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deals:", error);
      return NextResponse.json(
        { error: "Failed to fetch deals" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deals });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals GET:", error);
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
    const listingId = parseInt(id, 10);
    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    const body = await request.json();

    const dealData: DealInsert = {
      listing_id: listingId,
      title: body.title,
      description: body.description,
      deal_type: body.deal_type,
      bank_id: body.bank_id || null,
      discount_value: body.discount_value,
      start_date: body.start_date
        ? new Date(body.start_date).toISOString()
        : null,
      end_date: body.end_date ? new Date(body.end_date).toISOString() : null,
      is_active: body.is_active ?? true,
      valid_card_variants: body.valid_card_variants || null,
    };

    const { data, error } = await supabase
      .from("deals")
      .insert(dealData)
      .select(
        `
        *,
        banks (
          id,
          name,
          logo_url
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating deal:", error);
      return NextResponse.json(
        { error: "Failed to create deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deal: data });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals POST:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);
    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    const body = await request.json();
    const dealId = body.id;

    if (!dealId) {
      return NextResponse.json(
        { error: "Deal ID is required" },
        { status: 400 }
      );
    }

    const dealData: DealUpdate = {
      title: body.title,
      description: body.description,
      deal_type: body.deal_type,
      bank_id: body.bank_id || null,
      discount_value: body.discount_value,
      start_date: body.start_date
        ? new Date(body.start_date).toISOString()
        : null,
      end_date: body.end_date ? new Date(body.end_date).toISOString() : null,
      is_active: body.is_active ?? true,
      valid_card_variants: body.valid_card_variants || null,
    };

    const { data, error } = await supabase
      .from("deals")
      .update(dealData)
      .eq("id", parseInt(dealId))
      .eq("listing_id", listingId)
      .select(
        `
        *,
        banks (
          id,
          name,
          logo_url
        )
      `
      )
      .single();

    if (error) {
      console.error("Error updating deal:", error);
      return NextResponse.json(
        { error: "Failed to update deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deal: data });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals PUT:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);
    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    const access = await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });
    const supabase = access.adminSupabase;

    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("dealId");

    if (!dealId) {
      return NextResponse.json(
        { error: "Deal ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("deals")
      .delete()
      .eq("id", parseInt(dealId))
      .eq("listing_id", listingId);

    if (error) {
      console.error("Error deleting deal:", error);
      return NextResponse.json(
        { error: "Failed to delete deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals DELETE:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
