import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  createMobileServiceClient,
  type MobileSupabase,
} from "@/lib/mobile/supabase";

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
  service: MobileSupabase,
  userId: string,
  qrCodeId: number,
  start: string | null,
): Promise<number> {
  let q = service
    .from("qr_scans")
    .select("scanned_at", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("qr_code_id", qrCodeId);
  if (start) q = q.gte("scanned_at", start);
  const { count } = await q;
  return count ?? 0;
}

/**
 * POST /api/mobile/v1/gamification/qr-scan
 *
 * Body `{ code, location?, deviceInfo? }`. Validates the QR code, enforces its
 * per-user scan limit (daily/weekly/once), records the scan with a deterministic
 * winner-selection to undo concurrent race losers, then awards XP via the shared
 * `awardXP("visit_location", ...)`. Writes use a service-role client after the
 * caller is authenticated. Mirrors `app/api/gamification/qr-codes/scan`.
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

  const service = createMobileServiceClient();

  const { data: qrCode } = await service
    .from("qr_codes")
    .select("id, is_active, expires_at, scan_limit_type, xp_reward, qr_type")
    .eq("code", code)
    .maybeSingle();
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
    if ((await scanCountInWindow(service, user.id, qrCode.id, start)) > 0) {
      throw new MobileApiError("already_scanned", limitMessage, 400);
    }
  }

  const { data: scan, error: scanError } = await service
    .from("qr_scans")
    .insert({
      user_id: user.id,
      qr_code_id: qrCode.id,
      xp_awarded: 0,
      scan_location: location ?? null,
      device_info: deviceInfo ?? null,
    })
    .select("id, scanned_at")
    .single();
  if (scanError || !scan) {
    if (scanError?.code === "23505") {
      throw new MobileApiError("already_scanned", limitMessage, 400);
    }
    console.error("[mobile-api] qr scan insert failed:", scanError?.message);
    throw new MobileApiError("internal_error", "Failed to record scan.", 500);
  }

  // Deterministic winner-selection: if a concurrent scan landed first in the
  // window, delete this one and reject.
  if (limited) {
    const start = windowStart(limitType, new Date(scan.scanned_at));
    let wq = service
      .from("qr_scans")
      .select("id")
      .eq("user_id", user.id)
      .eq("qr_code_id", qrCode.id)
      .order("scanned_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1);
    if (start) wq = wq.gte("scanned_at", start);
    const { data: winner } = await wq;
    const winnerId = winner?.[0]?.id;
    if (winnerId && winnerId !== scan.id) {
      await service.from("qr_scans").delete().eq("id", scan.id);
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
      const { error: xpUpdateError } = await service
        .from("qr_scans")
        .update({ xp_awarded: xpAwarded })
        .eq("id", scan.id);
      if (xpUpdateError) {
        console.error(
          "[mobile-api] qr scan xp_awarded update failed:",
          xpUpdateError.message,
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
