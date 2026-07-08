import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user - let RLS policies handle authorization
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { listingId, featureId, action } = await request.json();

    if (action === "add") {
      const { data, error } = await supabase
        .from("listing_features")
        .insert({
          listing_id: listingId,
          feature_id: featureId,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to add feature", details: error },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === "remove") {
      const { error } = await supabase
        .from("listing_features")
        .delete()
        .eq("listing_id", listingId)
        .eq("feature_id", featureId);

      if (error) {
        return NextResponse.json(
          { error: "Failed to remove feature", details: error },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "add" or "remove"' },
      { status: 400 },
    );
  } catch (error) {
    console.error("Admin features API error:", error);
    return NextResponse.json(
      { error: "Unauthorized or server error" },
      { status: 401 },
    );
  }
}
