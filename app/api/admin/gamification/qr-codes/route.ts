import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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

async function verifyAdmin(userId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return isGamificationOperatorRole(rows[0]?.role);
}

// GET - Fetch all QR codes
export async function GET(_request: NextRequest) {
  try {
    // Verify admin access
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    if (!(await verifyAdmin(session.userId))) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch QR codes
    let qrCodes;
    try {
      const { rows } = await query(
        `SELECT * FROM public.qr_codes ORDER BY created_at DESC`,
      );
      qrCodes = rows;
    } catch (error) {
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
        const { rows: countRows } = await query(
          `SELECT COUNT(*) FROM public.qr_scans WHERE qr_code_id = $1`,
          [qr.id],
        );
        const count = Number(countRows[0]?.count ?? 0);

        // Get listing name if related_id exists and > 0
        let listingName = null;
        if (qr.related_id && qr.related_id > 0) {
          const { rows: listingRows } = await query(
            `SELECT name FROM public.listings WHERE id = $1 LIMIT 1`,
            [qr.related_id],
          );
          listingName = listingRows[0]?.name || null;
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
  try {
    // Verify admin access
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    if (!(await verifyAdmin(session.userId))) {
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
      const { rows: existingRows } = await query(
        `SELECT id FROM public.qr_codes WHERE code = $1 LIMIT 1`,
        [code],
      );

      if (existingRows.length === 0) break;
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
    let qrCode;
    try {
      const { rows } = await query(
        `INSERT INTO public.qr_codes
           (code, qr_type, xp_reward, scan_limit_type, is_active, related_id, expires_at, created_by)
         VALUES ($1, $2, $3, $4, true, $5, $6, $7)
         RETURNING *`,
        [
          code,
          finalQrType,
          xp_value || 50,
          cooldown_type || "once",
          finalRelatedId,
          expires_at || null,
          session.userId,
        ],
      );
      qrCode = rows[0];
    } catch (createError) {
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
  try {
    // Verify admin access
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    if (!(await verifyAdmin(session.userId))) {
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
    try {
      await query(`DELETE FROM public.qr_codes WHERE id = $1`, [parseInt(id)]);
    } catch (deleteError) {
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
