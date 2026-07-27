import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  try {
    const { code, location, deviceInfo } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "QR code is required" },
        { status: 400 }
      );
    }

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch QR code details
    const { rows: qrCodeRows } = await query(
      `SELECT * FROM public.qr_codes WHERE code = $1 LIMIT 1`,
      [code],
    );
    const qrCode = qrCodeRows[0];

    if (!qrCode) {
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
      const now = new Date();
      let sinceClause = "";
      let sinceValue: string | null = null;

      if (qrCode.scan_limit_type === "daily") {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        sinceClause = "AND scanned_at >= $3";
        sinceValue = startOfDay;
        limitError = "You have already scanned this QR code today";
      } else if (qrCode.scan_limit_type === "weekly") {
        // Get start of week (Monday)
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        const startOfWeek = d.toISOString();

        sinceClause = "AND scanned_at >= $3";
        sinceValue = startOfWeek;
        limitError = "You have already scanned this QR code this week";
      } else if (qrCode.scan_limit_type === "once") {
        // No date filter needed
        limitError = "You have already scanned this QR code";
      }

      let count: number;
      try {
        const params: unknown[] = [session.userId, qrCode.id];
        if (sinceValue) params.push(sinceValue);
        const { rows: countRows } = await query(
          `SELECT COUNT(*) FROM public.qr_scans
           WHERE user_id = $1 AND qr_code_id = $2 ${sinceClause}`,
          params,
        );
        count = Number(countRows[0]?.count ?? 0);
      } catch (countError) {
        console.error("Error checking scan limit:", countError);
        return NextResponse.json(
          { error: "Failed to verify scan eligibility" },
          { status: 500 }
        );
      }

      if (count > 0) {
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

    let insertedScan: { id: number; scanned_at: string } | undefined;
    try {
      const { rows: insertedRows } = await query(
        `INSERT INTO public.qr_scans (user_id, qr_code_id, xp_awarded, scan_location, device_info)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, scanned_at`,
        [
          session.userId,
          qrCode.id,
          0,
          location ? JSON.stringify(location) : null,
          deviceInfo ? JSON.stringify(deviceInfo) : null,
        ],
      );
      insertedScan = insertedRows[0];
    } catch (scanError) {
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

    if (!insertedScan) {
      return NextResponse.json(
        { error: "Failed to record scan" },
        { status: 500 }
      );
    }

    // Deterministic winner selection for non-unlimited scans.
    if (qrCode.scan_limit_type !== "unlimited") {
      let winnerSinceClause = "";
      let winnerSinceValue: string | null = null;
      const scannedAt = new Date(insertedScan.scanned_at);

      if (qrCode.scan_limit_type === "daily") {
        const dayStart = new Date(scannedAt);
        dayStart.setHours(0, 0, 0, 0);
        winnerSinceClause = "AND scanned_at >= $3";
        winnerSinceValue = dayStart.toISOString();
      } else if (qrCode.scan_limit_type === "weekly") {
        const weekStart = new Date(scannedAt);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        winnerSinceClause = "AND scanned_at >= $3";
        winnerSinceValue = weekStart.toISOString();
      }

      let winnerRows: { id: number }[];
      try {
        const params: unknown[] = [session.userId, qrCode.id];
        if (winnerSinceValue) params.push(winnerSinceValue);
        const { rows } = await query(
          `SELECT id FROM public.qr_scans
           WHERE user_id = $1 AND qr_code_id = $2 ${winnerSinceClause}
           ORDER BY scanned_at ASC, id ASC
           LIMIT 1`,
          params,
        );
        winnerRows = rows as { id: number }[];
      } catch (winnerError) {
        console.error("Error evaluating scan winner:", winnerError);
        return NextResponse.json(
          { error: "Failed to verify scan eligibility" },
          { status: 500 }
        );
      }

      const winnerId = winnerRows?.[0]?.id;
      if (winnerId && Number(winnerId) !== Number(insertedScan.id)) {
        await query(`DELETE FROM public.qr_scans WHERE id = $1`, [insertedScan.id]);
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
        session.userId,
        "visit_location",
        qrCode.id,
        qrCode.xp_reward
      );

      if ("success" in result && result.success) {
        xpAwarded = result.xp_awarded || 0;
        message = `Successfully scanned! +${xpAwarded} XP`;

        // Update the scan record with the actual XP awarded
        await query(
          `UPDATE public.qr_scans SET xp_awarded = $1 WHERE id = $2`,
          [xpAwarded, insertedScan.id],
        );
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
