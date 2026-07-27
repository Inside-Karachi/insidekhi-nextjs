import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1).max(512),
  location: z.string().max(256).optional(),
  deviceInfo: z.string().max(512).optional(),
});

/** Window start for a scan-limit type, or null for "once"/"unlimited". */
function windowStart(limitType: string, ref: Date): string | null {
  if (limitType === "daily") {
    const d = new Date(ref);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (limitType === "weekly") {
    const d = new Date(ref);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Monday
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return null;
}

async function scanCountInWindow(
  userId: string,
  qrCodeId: number,
  start: string | null,
): Promise<number> {
  const params: unknown[] = [userId, qrCodeId];
  let sinceClause = "";
  if (start) {
    params.push(start);
    sinceClause = "AND scanned_at >= $3";
  }
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM qr_scans
     WHERE user_id = $1 AND qr_code_id = $2 ${sinceClause}`,
    params,
  );
  return rows[0]?.count ?? 0;
}

/**
 * POST /api/mobile/v1/gamification/qr-scan
 *
 * Body `{ code, location?, deviceInfo? }`. Validates the QR code, enforces its
 * per-user scan limit (daily/weekly/once), records the scan with a deterministic
 * winner-selection to undo concurrent race losers, then awards XP via the shared
 * `awardXP("visit_location", ...)`. Mirrors `app/api/gamification/qr-codes/scan`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request); // IP-keyed before auth (unauth-flood guard)
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A QR code is required.",
      400,
      "code",
    );
  }
  const { code, location, deviceInfo } = parsed.data;

  const { rows: qrCodeRows } = await query(
    `SELECT id, is_active, expires_at, scan_limit_type, xp_reward, qr_type
     FROM qr_codes WHERE code = $1 LIMIT 1`,
    [code],
  );
  const qrCode = qrCodeRows[0];
  if (!qrCode) {
    throw new MobileApiError("not_found", "Invalid QR code.", 404);
  }
  if (!qrCode.is_active) {
    throw new MobileApiError(
      "qr_inactive",
      "This QR code is no longer active.",
      400,
    );
  }
  if (qrCode.expires_at && new Date(qrCode.expires_at) < new Date()) {
    throw new MobileApiError("qr_expired", "This QR code has expired.", 400);
  }

  const limitType = qrCode.scan_limit_type ?? "unlimited";
  const limited = limitType !== "unlimited";
  const limitMessage =
    limitType === "daily"
      ? "You have already scanned this QR code today."
      : limitType === "weekly"
        ? "You have already scanned this QR code this week."
        : "You have already scanned this QR code.";

  // Fast pre-check (winner-selection below is the race-safe guard).
  if (limited) {
    const start = windowStart(limitType, new Date());
    if ((await scanCountInWindow(user.id, qrCode.id, start)) > 0) {
      throw new MobileApiError("already_scanned", limitMessage, 400);
    }
  }

  let scan: { id: number; scanned_at: string } | undefined;
  try {
    const { rows } = await query(
      `INSERT INTO qr_scans (user_id, qr_code_id, xp_awarded, scan_location, device_info)
       VALUES ($1, $2, 0, $3, $4)
       RETURNING id, scanned_at`,
      [user.id, qrCode.id, location ?? null, deviceInfo ?? null],
    );
    scan = rows[0];
  } catch (scanError) {
    if ((scanError as { code?: string } | null)?.code === "23505") {
      throw new MobileApiError("already_scanned", limitMessage, 400);
    }
    console.error("[mobile-api] qr scan insert failed:", scanError);
  }
  if (!scan) {
    throw new MobileApiError("internal_error", "Failed to record scan.", 500);
  }

  // Deterministic winner-selection: if a concurrent scan landed first in the
  // window, delete this one and reject.
  if (limited) {
    const start = windowStart(limitType, new Date(scan.scanned_at));
    const params: unknown[] = [user.id, qrCode.id];
    let sinceClause = "";
    if (start) {
      params.push(start);
      sinceClause = "AND scanned_at >= $3";
    }
    const { rows: winnerRows } = await query(
      `SELECT id FROM qr_scans
       WHERE user_id = $1 AND qr_code_id = $2 ${sinceClause}
       ORDER BY scanned_at ASC, id ASC
       LIMIT 1`,
      params,
    );
    const winnerId = winnerRows?.[0]?.id;
    if (winnerId && Number(winnerId) !== Number(scan.id)) {
      await query(`DELETE FROM qr_scans WHERE id = $1`, [scan.id]);
      throw new MobileApiError("already_scanned", limitMessage, 400);
    }
  }

  // Award XP through the shared service (respects 'visit_location' config).
  let xpAwarded = 0;
  try {
    const { awardXP } = await import("@/lib/gamification");
    const result = await awardXP(
      user.id,
      "visit_location",
      qrCode.id,
      qrCode.xp_reward ?? undefined,
    );
    if ("success" in result && result.success) {
      xpAwarded = result.xp_awarded ?? 0;
      try {
        await query(`UPDATE qr_scans SET xp_awarded = $1 WHERE id = $2`, [
          xpAwarded,
          scan.id,
        ]);
      } catch (xpUpdateError) {
        console.error(
          "[mobile-api] qr scan xp_awarded update failed:",
          xpUpdateError,
        );
      }
    } else if ("error" in result && result.status !== 403) {
      console.warn("[mobile-api] qr awardXP warning:", result.error);
    }
  } catch (err) {
    console.error("[mobile-api] qr awardXP failed:", err);
  }

  return ok({
    success: true,
    xp_awarded: xpAwarded,
    qr_type: qrCode.qr_type,
  });
});
