import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const listingId = Number(url.searchParams.get("listingId"));
  if (!listingId)
    return NextResponse.json({ error: "missing_listing_id" }, { status: 400 });

  const session = await getSession(request);

  // If user is not authenticated, return favorited: false
  if (!session) {
    return NextResponse.json({
      favorited: false,
    });
  }

  try {
    const { rows } = await query(
      `SELECT 1 FROM favorite_listings WHERE user_id = $1 AND listing_id = $2 LIMIT 1`,
      [session.userId, listingId]
    );

    return NextResponse.json({
      favorited: rows.length > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const listingId = Number(body.listingId);
    if (!listingId)
      return NextResponse.json(
        { error: "missing_listing_id" },
        { status: 400 }
      );

    const session = await getSession(request);
    if (!session)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    // Always scope to the caller's own session id - never trust a
    // request-supplied user id.
    const { rows: existing } = await query(
      `SELECT 1 FROM favorite_listings WHERE user_id = $1 AND listing_id = $2 LIMIT 1`,
      [session.userId, listingId]
    );

    if (existing.length > 0) {
      await query(
        `DELETE FROM favorite_listings WHERE user_id = $1 AND listing_id = $2`,
        [session.userId, listingId]
      );
      return NextResponse.json({ favorited: false });
    }

    await query(
      `INSERT INTO favorite_listings (user_id, listing_id) VALUES ($1, $2)`,
      [session.userId, listingId]
    );
    return NextResponse.json({ favorited: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
