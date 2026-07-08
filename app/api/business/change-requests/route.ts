import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyBusinessOwner } from "@/lib/business-owner/api-utils";

// GET: Fetch all change requests for business owner's listings
export async function GET(_request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();

    // Fetch all change requests for listings owned by this user
    const { data: requests, error } = await supabase
      .from("listing_change_requests")
      .select(
        `
        *,
        listings:listing_id (
          name,
          status
        )
      `,
      )
      .eq("requested_by", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching change requests:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch change requests",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        requests: requests || [],
        total: requests?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/business/change-requests:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 500,
      },
    );
  }
}
