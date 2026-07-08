/** Listing scraper coordination state (Upstash Redis). */

import { Redis } from "@upstash/redis";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import type { SyncReport, SyncResult } from "@/types/peekaboo-scraper.types";

const REDIS_KEY_PREFIX = "scraper:";
const ACTIVE_SYNC_KEY = `${REDIS_KEY_PREFIX}active`;
const SYNC_LOCK_KEY = `${REDIS_KEY_PREFIX}sync_lock`;
const PROCESSED_IDS_KEY = `${REDIS_KEY_PREFIX}processed_ids`;
const COMPLETED_REPORT_KEY = `${REDIS_KEY_PREFIX}completed_report`;
const CONFIG_KEY = `${REDIS_KEY_PREFIX}config`;
const STOP_REQUEST_KEY_PREFIX = `${REDIS_KEY_PREFIX}stop_requested:`;

if (
  !process.env.UPSTASH_REDIS_REST_URL ||
  !process.env.UPSTASH_REDIS_REST_TOKEN
) {
  loadEnv({ path: resolve(process.cwd(), ".env.local") });
}

interface SyncProgress {
  current: number;
  total: number;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  currentEntity?: string;
}

/** Persisted to Redis: progress + metadata only (never per-entity result arrays). */
interface ActiveSyncState {
  syncId: string;
  userId: string;
  startTime: number;
  progress: SyncProgress;
  config: Record<string, unknown>;
  stopRequested: boolean;
}

interface StopRequestInfo {
  syncId: string;
  requestedAt: string;
}

export interface SyncLockInfo {
  syncId: string;
  ownerToken: string;
  acquiredAt: number;
  expiresAt: number;
}

class RedisScraperStateManager {
  private redis: Redis;

  // In-memory cache for performance
  private localCache: {
    processedIds: Set<number>;
    lastSync?: number;
  } = {
    processedIds: new Set(),
  };

  constructor() {
    this.redis = Redis.fromEnv();
    void this.refreshProcessedIdsFromRedis();
  }

  /**
   * Full reload from Redis so every instance matches the global `processed_ids` set
   * (required for multi-worker correctness). Also clears local cache when Redis is empty.
   */
  private async refreshProcessedIdsFromRedis(): Promise<void> {
    try {
      const raw = await this.redis.smembers(PROCESSED_IDS_KEY);
      const ids = Array.isArray(raw) ? raw : [];
      const numeric = new Set<number>();
      for (const id of ids) {
        const n = typeof id === "number" ? id : Number(id);
        if (Number.isFinite(n)) {
          numeric.add(n);
        }
      }
      this.localCache.processedIds = numeric;
      if (process.env.SCRAPER_DEBUG_LOGS === "true") {
        console.log(
          `[STATE] Refreshed processed IDs from Redis (${numeric.size} ids)`,
        );
      }
    } catch (error) {
      console.error(
        "[STATE] Failed to refresh processed IDs from Redis:",
        error,
      );
    }
  }

  /** Drops legacy fields (e.g. historical `results` blobs) when reading from Redis. */
  private sanitizeActiveSync(raw: unknown): ActiveSyncState | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Partial<ActiveSyncState> & { results?: unknown };
    if (!r.syncId || !r.progress || typeof r.progress !== "object") {
      return null;
    }
    return {
      syncId: r.syncId,
      userId: r.userId ?? "",
      startTime: typeof r.startTime === "number" ? r.startTime : Date.now(),
      progress: r.progress as SyncProgress,
      config:
        r.config && typeof r.config === "object"
          ? (r.config as Record<string, unknown>)
          : {},
      stopRequested: Boolean(r.stopRequested),
    };
  }

  /** One active sync at a time; uses SYNC_LOCK_KEY. */
  async acquireSyncLock(
    syncId: string,
    leaseMs: number,
    ownerToken: string,
  ): Promise<boolean> {
    const now = Date.now();
    const lock: SyncLockInfo = {
      syncId,
      ownerToken,
      acquiredAt: now,
      expiresAt: now + leaseMs,
    };

    const result = await this.redis.set(SYNC_LOCK_KEY, JSON.stringify(lock), {
      nx: true,
      px: leaseMs,
    });

    return result === "OK";
  }

  /**
   * Extend the lock only if this worker still owns it.
   */
  async extendSyncLock(
    syncId: string,
    leaseMs: number,
    ownerToken: string,
  ): Promise<boolean> {
    const now = Date.now();
    const lock: SyncLockInfo = {
      syncId,
      ownerToken,
      acquiredAt: now,
      expiresAt: now + leaseMs,
    };

    const script = `
      local current = redis.call("GET", KEYS[1])
      if not current then
        return 0
      end
      if string.find(current, ARGV[1], 1, true) == nil then
        return 0
      end
      redis.call("PSETEX", KEYS[1], ARGV[2], ARGV[3])
      return 1
    `;

    const result = await (
      this.redis as unknown as {
        eval: (
          script: string,
          keys: string[],
          args: string[],
        ) => Promise<number | string>;
      }
    ).eval(
      script,
      [SYNC_LOCK_KEY],
      [`"ownerToken":"${ownerToken}"`, String(leaseMs), JSON.stringify(lock)],
    );

    return Number(result) === 1;
  }

  /**
   * Release the lock only if this worker still owns it.
   */
  async releaseSyncLock(ownerToken: string): Promise<boolean> {
    const script = `
      local current = redis.call("GET", KEYS[1])
      if not current then
        return 0
      end
      if string.find(current, ARGV[1], 1, true) == nil then
        return 0
      end
      redis.call("DEL", KEYS[1])
      return 1
    `;

    const result = await (
      this.redis as unknown as {
        eval: (
          script: string,
          keys: string[],
          args: string[],
        ) => Promise<number | string>;
      }
    ).eval(script, [SYNC_LOCK_KEY], [`"ownerToken":"${ownerToken}"`]);

    return Number(result) === 1;
  }

  async getSyncLockInfo(): Promise<SyncLockInfo | null> {
    const raw = await this.redis.get<string | SyncLockInfo>(SYNC_LOCK_KEY);
    if (!raw) return null;

    if (typeof raw === "object") {
      return raw;
    }

    try {
      return JSON.parse(raw) as SyncLockInfo;
    } catch {
      return null;
    }
  }

  async getSyncLockTtlMs(): Promise<number> {
    const result = await (
      this.redis as unknown as {
        pttl: (key: string) => Promise<number>;
      }
    ).pttl(SYNC_LOCK_KEY);

    return result;
  }

  async clearExpiredActiveSyncState(): Promise<boolean> {
    const lock = await this.getSyncLockInfo();
    const ttlMs = await this.getSyncLockTtlMs();

    if (lock && (ttlMs > 0 || lock.expiresAt > Date.now())) {
      return false;
    }

    await Promise.all([
      this.redis.del(ACTIVE_SYNC_KEY),
      this.redis.del(SYNC_LOCK_KEY),
    ]);
    return true;
  }

  async reserveAlertCooldown(
    key: string,
    cooldownSeconds: number,
  ): Promise<boolean> {
    const result = await this.redis.set(
      `${REDIS_KEY_PREFIX}alert:${key}`,
      new Date().toISOString(),
      {
        nx: true,
        ex: cooldownSeconds,
      },
    );

    return result === "OK";
  }

  /**
   * Start a new sync operation
   */
  async startSync(
    syncId: string,
    userId: string,
    config: Record<string, unknown>,
    totalEntities: number,
  ): Promise<void> {
    const stopRequested = await this.consumeStopRequest(syncId);
    const activeSync: ActiveSyncState = {
      syncId,
      userId,
      startTime: Date.now(),
      config,
      stopRequested,
      progress: {
        current: 0,
        total: totalEntities,
        status: stopRequested ? "stopping" : "running",
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      },
    };

    await this.redis.set(ACTIVE_SYNC_KEY, activeSync);
    await this.redis.del(COMPLETED_REPORT_KEY);
  }

  /**
   * Update progress with a new result
   */
  async updateProgress(
    result: SyncResult,
    currentEntity?: string,
  ): Promise<void> {
    const raw = await this.redis.get(ACTIVE_SYNC_KEY);
    const activeSync = this.sanitizeActiveSync(raw);
    if (!activeSync) return;

    activeSync.progress.current++;

    // Mark as processed (atomic operation)
    if (result.success) {
      await this.redis.sadd(PROCESSED_IDS_KEY, result.peekabooId);
      this.localCache.processedIds.add(result.peekabooId);
    }

    if (result.action === "create") {
      activeSync.progress.created++;
    } else if (result.action === "update") {
      activeSync.progress.updated++;
    } else if (result.action === "skip") {
      activeSync.progress.skipped++;
    }

    if (!result.success || result.error) {
      activeSync.progress.errors++;
    }

    if (currentEntity) {
      activeSync.progress.currentEntity = currentEntity;
    }

    await this.redis.set(ACTIVE_SYNC_KEY, activeSync);
  }

  /**
   * Complete the sync operation
   */
  async completeSync(
    report: SyncReport,
    duration: number,
    ownerToken?: string,
  ): Promise<void> {
    const activeSync = await this.getActiveSync();
    const completedReport = {
      syncId: activeSync?.syncId || "unknown",
      report,
      duration,
    };

    await this.redis.set(COMPLETED_REPORT_KEY, completedReport, { ex: 3600 });

    await this.redis.del(ACTIVE_SYNC_KEY);
    if (activeSync?.syncId) {
      await this.clearStopRequest(activeSync.syncId);
    }
    if (ownerToken) {
      await this.releaseSyncLock(ownerToken);
    }
  }

  /**
   * Fail the sync operation
   */
  async failSync(_error: Error, ownerToken?: string): Promise<void> {
    const activeSync = await this.getActiveSync();
    if (activeSync) {
      const next: ActiveSyncState = {
        ...activeSync,
        progress: { ...activeSync.progress, status: "failed" },
      };
      await this.redis.set(ACTIVE_SYNC_KEY, next);
    }

    if (ownerToken) {
      await this.releaseSyncLock(ownerToken);
    }

    if (activeSync?.syncId) {
      await this.clearStopRequest(activeSync.syncId);
    }

    // Clean up after a delay
    setTimeout(async () => {
      await this.redis.del(ACTIVE_SYNC_KEY);
    }, 60000); // Keep failed state for 1 minute
  }

  /**
   * Get current progress
   */
  async getProgress(): Promise<SyncProgress | null> {
    const activeSync = await this.getActiveSync();
    return activeSync?.progress || null;
  }

  /**
   * Get active sync
   */
  private async getActiveSync(): Promise<ActiveSyncState | null> {
    const raw = await this.redis.get(ACTIVE_SYNC_KEY);
    return this.sanitizeActiveSync(raw);
  }

  /**
   * Get active sync ID
   */
  async getActiveSyncId(): Promise<string | null> {
    const activeSync = await this.getActiveSync();
    if (activeSync?.syncId) return activeSync.syncId;

    const lock = await this.getSyncLockInfo();
    return lock?.syncId || null;
  }

  /**
   * Check if sync is running
   */
  async isSyncRunning(): Promise<boolean> {
    const exists = await this.redis.exists(SYNC_LOCK_KEY);
    return exists === 1;
  }

  /**
   * Get completed report
   */
  async getCompletedReport(): Promise<{
    syncId: string;
    report: SyncReport;
    duration: number;
  } | null> {
    return await this.redis.get<{
      syncId: string;
      report: SyncReport;
      duration: number;
    }>(COMPLETED_REPORT_KEY);
  }

  /**
   * Request graceful stop
   */
  async requestStop(targetSyncId?: string): Promise<{
    syncId: string | null;
    state: "requested" | "already-stopping" | "not-running";
  }> {
    const activeSync = await this.getActiveSync();
    const lock = await this.getSyncLockInfo();
    const syncId = targetSyncId || activeSync?.syncId || lock?.syncId || null;

    if (!syncId) {
      return { syncId: null, state: "not-running" };
    }

    const stopKey = `${STOP_REQUEST_KEY_PREFIX}${syncId}`;
    const alreadyRequested = (await this.redis.exists(stopKey)) === 1;
    await this.redis.set(
      stopKey,
      {
        syncId,
        requestedAt: new Date().toISOString(),
      } as StopRequestInfo,
      { ex: 6 * 60 * 60 },
    );

    if (activeSync && activeSync.syncId === syncId) {
      const next: ActiveSyncState = {
        ...activeSync,
        stopRequested: true,
        progress: { ...activeSync.progress, status: "stopping" },
      };
      await this.redis.set(ACTIVE_SYNC_KEY, next);
    }

    console.log(`[STATE] Graceful stop requested for sync ${syncId}`);
    return {
      syncId,
      state: alreadyRequested ? "already-stopping" : "requested",
    };
  }

  /**
   * Check if stop was requested
   */
  async isStopRequested(syncId?: string): Promise<boolean> {
    const activeSync = await this.getActiveSync();
    const targetSyncId = syncId || activeSync?.syncId;
    if (!targetSyncId) {
      return activeSync?.stopRequested || false;
    }

    const keyExists =
      (await this.redis.exists(`${STOP_REQUEST_KEY_PREFIX}${targetSyncId}`)) ===
      1;
    return keyExists || activeSync?.stopRequested || false;
  }

  async consumeStopRequest(syncId: string): Promise<boolean> {
    const key = `${STOP_REQUEST_KEY_PREFIX}${syncId}`;
    const exists = (await this.redis.exists(key)) === 1;
    return exists;
  }

  async clearStopRequest(syncId: string): Promise<void> {
    await this.redis.del(`${STOP_REQUEST_KEY_PREFIX}${syncId}`);
  }

  /**
   * Check if an entity was already processed (fast local cache)
   */
  isProcessed(peekabooId: number): boolean {
    return this.localCache.processedIds.has(peekabooId);
  }

  /**
   * Mark an entity as processed
   */
  async markProcessed(peekabooId: number): Promise<void> {
    await this.redis.sadd(PROCESSED_IDS_KEY, peekabooId);
    this.localCache.processedIds.add(peekabooId);
  }

  /**
   * Clear all state (for testing or forced reset)
   */
  async clear(): Promise<void> {
    const lock = await this.getSyncLockInfo();
    await Promise.all([
      this.redis.del(ACTIVE_SYNC_KEY),
      this.redis.del(SYNC_LOCK_KEY),
      this.redis.del(PROCESSED_IDS_KEY),
      this.redis.del(COMPLETED_REPORT_KEY),
      this.redis.del(CONFIG_KEY),
      ...(lock?.syncId
        ? [this.redis.del(`${STOP_REQUEST_KEY_PREFIX}${lock.syncId}`)]
        : []),
    ]);

    this.localCache.processedIds.clear();
  }

  /**
   * Clear only the active sync lock (used for orphaned/stale run recovery).
   */
  async clearActiveSyncLock(): Promise<void> {
    await this.redis.del(ACTIVE_SYNC_KEY);
    await this.redis.del(SYNC_LOCK_KEY);
  }

  /**
   * Get count of processed entities
   */
  async getProcessedCount(): Promise<number> {
    return await this.redis.scard(PROCESSED_IDS_KEY);
  }

  /**
   * Snapshot of processed Peekaboo IDs from Redis (always refreshed).
   * Ensures multiple worker instances share one consistent view for incremental sync.
   */
  async getProcessedIds(): Promise<Set<number>> {
    await this.refreshProcessedIdsFromRedis();
    return new Set(this.localCache.processedIds);
  }

  /**
   * Clear only the processed IDs set (for full resync mode).
   */
  async clearProcessedIds(): Promise<void> {
    await this.redis.del(PROCESSED_IDS_KEY);
    this.localCache.processedIds.clear();
  }

  /**
   * Save scraper configuration to Redis
   */
  async saveConfig(config: Record<string, unknown>): Promise<void> {
    await this.redis.set(CONFIG_KEY, config);
  }

  /**
   * Get scraper configuration from Redis
   */
  async getConfig(): Promise<Record<string, unknown> | null> {
    return await this.redis.get<Record<string, unknown>>(CONFIG_KEY);
  }
}

// Singleton instance
export const redisScraperState = new RedisScraperStateManager();

// Export both for backward compatibility
export const syncStateManager = redisScraperState;
