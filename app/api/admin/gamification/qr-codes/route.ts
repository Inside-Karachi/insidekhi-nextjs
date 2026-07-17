import { createServerSupabase } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

/**
 * Admin QR Code Management API
 *
 * GET: Fetch all QR codes with scan counts
 * POST: Create a new QR code for partner locations
 * DELETE: Delete a QR code by ID
 */

// Generate a unique QR code string
function generateQRCode(): string {
  // Format: IKQ-XXXXXX (Inside Karachi QR)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: I, O, 0, 1
  let code = "IKQ-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET - Fetch all QR codes
export async function GET(_request: NextRequest) {
    const supabase = await createServerSupabase();
  try {    // Verify admin access
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profileError || !isGamificationOperatorRole(profile?.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch QR codes
    const { data: qrCodes, error } = await supabase
      .from("qr_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching QR codes:", error);
      return NextResponse.json(
        { error: "Failed to fetch QR codes" },
        { status: 500 }
      );
    }

    // Get scan counts and listing names for each QR code
    const qrCodesWithStats = await Promise.all(
      (qrCodes || []).map(async (qr) => {
        // Get scan count
        const { count } = await supabase
          .from("qr_scans")
          .select("*", { count: "exact", head: true })
          .eq("qr_code_id", qr.id);

        // Get listing name if related_id exists and > 0
        let listingName = null;
        if (qr.related_id && qr.related_id > 0) {
          const { data: listing } = await supabase
            .from("listings")
            .select("name")
            .eq("id", qr.related_id)
            .single();
          listingName = listing?.name || null;
        }

        return {
          id: qr.id,
          code: qr.code,
          name: qr.qr_type || "Location QR",
          description: `XP Reward: ${qr.xp_reward}`,
          xp_value: qr.xp_reward,
          cooldown_type: qr.scan_limit_type,
          is_active: qr.is_active,
          expires_at: qr.expires_at,
          listing_id: qr.related_id,
          listing: listingName ? { name: listingName } : null,
          scan_count: count || 0,
          created_at: qr.created_at,
        };
      })
    );

    return NextResponse.json({ qrCodes: qrCodesWithStats });
  } catch (error) {
    console.error("QR Codes fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new QR code
export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
  try {    // Verify admin access
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profileError || !isGamificationOperatorRole(profile?.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name: _name, // Display name (not used in DB, kept for future)
      qr_type, // Must be 'listing', 'event', or 'ticket'
      xp_value,
      cooldown_type,
      listing_id,
      event_id,
      expires_at,
    } = body;

    // Determine the type and related_id based on what's provided
    const finalQrType: string = qr_type || "listing";
    let finalRelatedId: number;

    // Validate qr_type
    const validTypes = ["listing", "event", "ticket"];
    if (!validTypes.includes(finalQrType)) {
      return NextResponse.json(
        { error: `Invalid QR type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Determine related_id based on type
    // For listing and event types, related_id is OPTIONAL (can be 0 for testing)
    if (finalQrType === "listing") {
      finalRelatedId = listing_id ? parseInt(listing_id) : 0;
    } else if (finalQrType === "event") {
      finalRelatedId = event_id ? parseInt(event_id) : 0;
    } else {
      // For ticket type, related_id can be 0 or event_id
      finalRelatedId = event_id ? parseInt(event_id) : 0;
    }

    // Generate unique code
    let code = generateQRCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure uniqueness
    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from("qr_codes")
        .select("id")
        .eq("code", code)
        .single();

      if (!existing) break;
      code = generateQRCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Failed to generate unique code. Please try again." },
        { status: 500 }
      );
    }

    // Create the QR code record
    const { data: qrCode, error: createError } = await supabase
      .from("qr_codes")
      .insert({
        code,
        qr_type: finalQrType,
        xp_reward: xp_value || 50,
        scan_limit_type: cooldown_type || "once",
        is_active: true,
        related_id: finalRelatedId,
        expires_at: expires_at || null,
        created_by: session.userId,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating QR code:", createError);
      return NextResponse.json(
        { error: "Failed to create QR code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      qrCode: {
        id: qrCode.id,
        code: qrCode.code,
        name: qrCode.qr_type,
        xp_value: qrCode.xp_reward,
        cooldown_type: qrCode.scan_limit_type,
        is_active: qrCode.is_active,
        created_at: qrCode.created_at,
      },
    });
  } catch (error) {
    console.error("QR Code creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a QR code
export async function DELETE(request: NextRequest) {
    const supabase = await createServerSupabase();
  try {    // Verify admin access
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profileError || !isGamificationOperatorRole(profile?.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "QR code ID is required" },
        { status: 400 }
      );
    }

    // Delete the QR code (scans will be orphaned but that's okay for history)
    const { error: deleteError } = await supabase
      .from("qr_codes")
      .delete()
      .eq("id", parseInt(id));

    if (deleteError) {
      console.error("Error deleting QR code:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete QR code" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("QR Code deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
