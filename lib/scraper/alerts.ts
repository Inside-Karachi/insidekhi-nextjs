import { query } from "@/lib/db";
import { syncStateManager } from "@/lib/scraper/redis-state-manager";

const DEFAULT_ALERT_COOLDOWN_SECONDS = 60 * 60;

type AlertKind = "sync_failure" | "stale_data";

interface AlertPayload {
  kind: AlertKind;
  title: string;
  message: string;
  syncId?: string;
  severity: "warning" | "error";
  metadata?: Record<string, unknown>;
}

function getWebhookUrl(): string {
  return process.env.SCRAPER_ALERT_WEBHOOK_URL?.trim() || "";
}

function getCooldownSeconds(): number {
  const raw = Number(process.env.SCRAPER_ALERT_COOLDOWN_SECONDS || "");
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_ALERT_COOLDOWN_SECONDS;
}

async function postAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      service: "inside-karachi-listing-scraper",
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Alert webhook responded with ${response.status}`);
  }
}

export async function sendScraperAlert(payload: AlertPayload): Promise<void> {
  if (!getWebhookUrl()) {
    return;
  }

  const cooldownKey = `${payload.kind}:${payload.syncId || "global"}`;
  const shouldSend = await syncStateManager.reserveAlertCooldown(
    cooldownKey,
    getCooldownSeconds(),
  );

  if (!shouldSend) {
    return;
  }

  try {
    await postAlert(payload);
  } catch (error) {
    console.error("[ALERT] Failed to send scraper alert:", error);
  }
}

export async function checkListingSyncFreshness(): Promise<void> {
  const staleHours = Number(process.env.SCRAPER_STALE_HOURS_ALERT || "");
  if (!getWebhookUrl() || !Number.isFinite(staleHours) || staleHours <= 0) {
    return;
  }

  try {
    const { rows } = await query(
      `SELECT id, completed_at FROM listing_sync_history
       WHERE status = $1
       ORDER BY completed_at DESC NULLS LAST
       LIMIT 1`,
      ["completed"],
    );
    const data = rows[0];

    const completedAt =
      typeof data?.completed_at === "string"
        ? new Date(data.completed_at).getTime()
        : 0;
    const ageMs = completedAt > 0 ? Date.now() - completedAt : Infinity;
    const thresholdMs = staleHours * 60 * 60 * 1000;

    if (ageMs <= thresholdMs) {
      return;
    }

    await sendScraperAlert({
      kind: "stale_data",
      title: "Listing scraper data is stale",
      message: data?.completed_at
        ? `Last successful listing sync completed at ${data.completed_at}.`
        : "No successful listing sync completion was found.",
      severity: "warning",
      metadata: {
        lastSuccessfulSyncId: data?.id ?? null,
        lastCompletedAt: data?.completed_at ?? null,
        staleHours,
      },
    });
  } catch (error) {
    console.error("[ALERT] Failed to check listing sync freshness:", error);
  }
}
