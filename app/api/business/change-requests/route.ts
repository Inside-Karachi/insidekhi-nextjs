import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyBusinessOwner } from "@/lib/business-owner/api-utils";

// GET: Fetch all change requests for business owner's listings
export async function GET(_request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();

    // Fetch all change requests for listings owned by this user
    let rows;
    try {
      const result = await query(
        `SELECT lcr.*, l.name AS "listing_name", l.status AS "listing_status"
         FROM listing_change_requests lcr
         LEFT JOIN listings l ON l.id = lcr.listing_id
         WHERE lcr.requested_by = $1
         ORDER BY lcr.created_at DESC`,
        [userId],
      );
      rows = result.rows;
    } catch (error) {
      console.error("Error fetching change requests:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch change requests",
        },
        { status: 500 },
      );
    }

    const requests = rows.map((row) => {
      const { listing_name, listing_status, ...rest } = row;
      return {
        ...rest,
        listings: { name: listing_name, status: listing_status },
      };
    });

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
