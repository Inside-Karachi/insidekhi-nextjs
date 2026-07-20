import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * GET /api/listings/[id]/opening-hours (PUBLIC)
 * Fetches opening hours for a listing (public access for frontend), optionally
 * filtered to a specific branch via ?branch_id=.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const branchIdParam = searchParams.get("branch_id");

    const whereParams: unknown[] = [listingId];
    let whereSql = "listing_id = $1";

    if (branchIdParam) {
      const branchId = parseInt(branchIdParam, 10);
      if (!isNaN(branchId)) {
        whereParams.push(branchId);
        whereSql += ` AND branch_id = $${whereParams.length}`;
      }
    } else {
      whereSql += " AND branch_id IS NULL";
    }

    const { rows } = await query(
      `SELECT * FROM opening_hours WHERE ${whereSql} ORDER BY day_of_week ASC`,
      whereParams,
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[OPENING HOURS] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
