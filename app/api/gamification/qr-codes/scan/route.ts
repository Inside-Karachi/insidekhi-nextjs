import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });
    const { code, location, deviceInfo } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "QR code is required" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const authSupabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch QR code details
    const { data: qrCode, error: qrError } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("code", code)
      .single();

    if (qrError || !qrCode) {
      return NextResponse.json(
        { error: "Invalid QR code" },
        { status: 404 }
      );
    }

    // 2. Check if active and not expired
    if (!qrCode.is_active) {
      return NextResponse.json(
        { error: "This QR code is no longer active" },
        { status: 400 }
      );
    }

    if (qrCode.expires_at && new Date(qrCode.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This QR code has expired" },
        { status: 400 }
      );
    }

    // 3. Fast pre-check for scan limits (race-safe winner selection runs after insert)
    let canScan = true;
    let limitError = "";

    if (qrCode.scan_limit_type !== "unlimited") {
      let query = supabase
        .from("qr_scans")
        .select("scanned_at", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("qr_code_id", qrCode.id);

      const now = new Date();

      if (qrCode.scan_limit_type === "daily") {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        query = query.gte("scanned_at", startOfDay);
        limitError = "You have already scanned this QR code today";
      } else if (qrCode.scan_limit_type === "weekly") {
        // Get start of week (Monday)
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        const startOfWeek = d.toISOString();

        query = query.gte("scanned_at", startOfWeek);
        limitError = "You have already scanned this QR code this week";
      } else if (qrCode.scan_limit_type === "once") {
        // No date filter needed
        limitError = "You have already scanned this QR code";
      }

      const { count, error: countError } = await query;

      if (countError) {
        console.error("Error checking scan limit:", countError);
        return NextResponse.json(
          { error: "Failed to verify scan eligibility" },
          { status: 500 }
        );
      }

      if (count && count > 0) {
        canScan = false;
      }
    }

    if (!canScan) {
      return NextResponse.json(
        { error: limitError },
        { status: 400 }
      );
    }

    // 4. Award XP and Log Scan

    const { data: insertedScan, error: scanError } = await supabase
      .from("qr_scans")
      .insert({
        user_id: user.id,
        qr_code_id: qrCode.id,
        xp_awarded: 0,
        scan_location: location || null,
        device_info: deviceInfo || null,
      })
      .select("id, scanned_at")
      .single();

    if (scanError || !insertedScan) {
      console.error("Error logging scan:", scanError);

      if ((scanError as { code?: string } | null)?.code === "23505") {
        return NextResponse.json(
          { error: (scanError as { message?: string }).message || limitError || "You have already scanned this QR code" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to record scan" },
        { status: 500 }
      );
    }

    // Deterministic winner selection for non-unlimited scans.
    if (qrCode.scan_limit_type !== "unlimited") {
      let winnerQuery = supabase
        .from("qr_scans")
        .select("id")
        .eq("user_id", user.id)
        .eq("qr_code_id", qrCode.id)
        .order("scanned_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(1);

      const scannedAt = new Date(insertedScan.scanned_at);
      if (qrCode.scan_limit_type === "daily") {
        const dayStart = new Date(scannedAt);
        dayStart.setHours(0, 0, 0, 0);
        winnerQuery = winnerQuery.gte("scanned_at", dayStart.toISOString());
      } else if (qrCode.scan_limit_type === "weekly") {
        const weekStart = new Date(scannedAt);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        winnerQuery = winnerQuery.gte("scanned_at", weekStart.toISOString());
      }

      const { data: winnerRows, error: winnerError } = await winnerQuery;

      if (winnerError) {
        console.error("Error evaluating scan winner:", winnerError);
        return NextResponse.json(
          { error: "Failed to verify scan eligibility" },
          { status: 500 }
        );
      }

      const winnerId = winnerRows?.[0]?.id;
      if (winnerId && winnerId !== insertedScan.id) {
        await supabase.from("qr_scans").delete().eq("id", insertedScan.id);
        return NextResponse.json(
          { error: limitError || "You have already scanned this QR code" },
          { status: 400 }
        );
      }
    }

    // Award XP using the centralized gamification service
    // This respects the 'visit_location' settings from the admin panel
    let xpAwarded = 0;
    let message = "Successfully scanned!";

    try {
      const { awardXP } = await import("@/lib/gamification");
      // Use the XP value from the QR code (override default if present)
      const result = await awardXP(
        user.id,
        "visit_location",
        qrCode.id,
        qrCode.xp_reward
      );

      if ("success" in result && result.success) {
        xpAwarded = result.xp_awarded || 0;
        message = `Successfully scanned! +${xpAwarded} XP`;

        // Update the scan record with the actual XP awarded
        await supabase
          .from("qr_scans")
          .update({ xp_awarded: xpAwarded })
          .eq("id", insertedScan.id);
      } else if ("error" in result && result.status !== 403) {
        // Log error but don't fail the user interaction if it's just a gamification issue
        console.warn("Gamification award warning:", result.error);
      }
    } catch (xpError) {
      console.error("Error calling awardXP:", xpError);
    }

    return NextResponse.json({
      success: true,
      xp_awarded: xpAwarded,
      message: message,
      qr_type: qrCode.qr_type,
    });

  } catch (error) {
    console.error("QR Scan error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
