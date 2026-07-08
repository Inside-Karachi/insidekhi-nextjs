import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const listingId = Number(url.searchParams.get("listingId"));
  if (!listingId)
    return NextResponse.json({ error: "missing_listing_id" }, { status: 400 });

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is not authenticated, return favorited: false
  if (!user) {
    return NextResponse.json({
      favorited: false,
    });
  }

  const { data, error } = await supabase
    .from("favorite_listings")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    favorited: Array.isArray(data) && data.length > 0,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const listingId = Number(body.listingId);
    if (!listingId)
      return NextResponse.json(
        { error: "missing_listing_id" },
        { status: 400 }
      );

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    // Use an admin client for the actual DB modifications to avoid RLS blocking
    let supabaseAdmin;
    try {
      supabaseAdmin = await createServerSupabase({ useServiceRole: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Common cause: SUPABASE_SERVICE_ROLE_KEY not set in env
      return NextResponse.json(
        { error: "service_role_unavailable", message },
        { status: 500 }
      );
    }

    // Check existing using admin client
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("favorite_listings")
      .select("*")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .limit(1);

    if (selErr)
      return NextResponse.json({ error: selErr.message }, { status: 500 });

    if (existing && existing.length > 0) {
      // Remove favorite using admin client
      const { error: delErr } = await supabaseAdmin
        .from("favorite_listings")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", listingId);

      if (delErr)
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      return NextResponse.json({ favorited: false });
    }

    // Insert favorite
    const { error: insertErr } = await supabaseAdmin
      .from("favorite_listings")
      .insert({ user_id: user.id, listing_id: listingId });

    if (insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ favorited: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
