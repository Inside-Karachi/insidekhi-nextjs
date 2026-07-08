/**
 * @deprecated Use redis-state-manager.ts instead (kept for backward compatibility).
 */

import type { SyncReport, SyncResult } from "@/types/peekaboo-scraper.types";

const STORAGE_KEY_PREFIX = "scraper_";
const PROCESSED_IDS_KEY = `${STORAGE_KEY_PREFIX}processed_ids`;
const LAST_SYNC_KEY = `${STORAGE_KEY_PREFIX}last_sync`;

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

interface ActiveSync {
  syncId: string;
  userId: string;
  startTime: number;
  progress: SyncProgress;
  config: Record<string, unknown>;
  results: SyncResult[];
  stopRequested: boolean;
}

class SyncStateManager {
  private activeSync: ActiveSync | null = null;
  private completedReport: {
    syncId: string;
    report: SyncReport;
    duration: number;
  } | null = null;
  private processedIds: Set<number> = new Set();

  constructor() {
    // Load persisted state from localStorage/file
    this.loadPersistedState();
  }

  /**
   * Load persisted processed IDs from storage
   */
  private loadPersistedState(): void {
    if (typeof window !== "undefined") {
      // Browser environment
      try {
        const stored = localStorage.getItem(PROCESSED_IDS_KEY);
        if (stored) {
          const ids = JSON.parse(stored) as number[];
          this.processedIds = new Set(ids);
          console.log(
            `[STATE] Loaded ${ids.length} processed IDs from storage`,
          );
        }
      } catch (error) {
        console.error("[STATE] Failed to load persisted state:", error);
      }
    } else {
      // Node.js environment - use file-based storage
      // TODO: Implement file-based persistence for Node.js
    }
  }

  /**
   * Persist processed IDs to storage
   */
  private persistState(): void {
    if (typeof window !== "undefined") {
      try {
        const ids = Array.from(this.processedIds);
        localStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(ids));
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      } catch (error) {
        console.error("[STATE] Failed to persist state:", error);
      }
    }
  }

  /**
   * Check if an entity was already processed
   */
  isProcessed(peekabooId: number): boolean {
    return this.processedIds.has(peekabooId);
  }

  /**
   * Mark an entity as processed
   */
  markProcessed(peekabooId: number): void {
    this.processedIds.add(peekabooId);
    this.persistState();
  }

  /**
   * Start a new sync operation
   */
  startSync(
    syncId: string,
    userId: string,
    config: Record<string, unknown>,
    totalEntities: number,
  ): void {
    if (this.activeSync) {
      throw new Error("A sync operation is already in progress");
    }

    this.activeSync = {
      syncId,
      userId,
      startTime: Date.now(),
      config,
      results: [],
      stopRequested: false,
      progress: {
        current: 0,
        total: totalEntities,
        status: "running",
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      },
    };

    // Clear old completed report
    this.completedReport = null;
  }

  /**
   * Update progress with a new result
   */
  updateProgress(result: SyncResult, currentEntity?: string): void {
    if (!this.activeSync) {
      return;
    }

    this.activeSync.results.push(result);
    this.activeSync.progress.current++;

    if (result.action === "create") {
      this.activeSync.progress.created++;
    } else if (result.action === "update") {
      this.activeSync.progress.updated++;
    } else if (result.action === "skip") {
      this.activeSync.progress.skipped++;
    }

    if (!result.success || result.error) {
      this.activeSync.progress.errors++;
    }

    if (currentEntity) {
      this.activeSync.progress.currentEntity = currentEntity;
    }
  }

  /**
   * Complete the sync operation
   */
  completeSync(report: SyncReport, duration: number): void {
    if (!this.activeSync) {
      return;
    }

    this.completedReport = {
      syncId: this.activeSync.syncId,
      report,
      duration,
    };

    this.activeSync = null;
  }

  /**
   * Fail the sync operation
   */
  failSync(_error: Error): void {
    if (!this.activeSync) {
      return;
    }

    this.activeSync.progress.status = "failed";
    this.activeSync = null;
  }

  /**
   * Get current progress
   */
  getProgress(): SyncProgress | null {
    return this.activeSync?.progress || null;
  }

  /**
   * Get active sync ID
   */
  getActiveSyncId(): string | null {
    return this.activeSync?.syncId || null;
  }

  /**
   * Check if sync is running
   */
  isSyncRunning(): boolean {
    return this.activeSync !== null;
  }

  /**
   * Get completed report (available briefly after completion)
   */
  getCompletedReport(): {
    syncId: string;
    report: SyncReport;
    duration: number;
  } | null {
    return this.completedReport;
  }

  /* Request graceful stop (from UI, API, or signal handlers)
   */
  requestStop(): void {
    if (this.activeSync) {
      this.activeSync.stopRequested = true;
      this.activeSync.progress.status = "stopping";
      console.log("[SYNC STATE] Graceful stop requested");
    }
  }

  /**
   * Check if stop was requested
   */
  isStopRequested(): boolean {
    return this.activeSync?.stopRequested || false;
  }

  /**
   * Clear state (for testing or forcing full resync)
   */
  clear(): void {
    this.activeSync = null;
    this.completedReport = null;
    this.processedIds.clear();

    if (typeof window !== "undefined") {
      localStorage.removeItem(PROCESSED_IDS_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
    }
  }

  /**
   * Get count of processed entities
   */
  getProcessedCount(): number {
    return this.processedIds.size;
  }
}

// Singleton instance
export const syncStateManager = new SyncStateManager();
