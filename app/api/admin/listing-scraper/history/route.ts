import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncStateManager } from "@/lib/scraper/redis-state-manager";
import {
  getAdminAuthErrorStatus,
  requireSuperAdmin,
} from "@/lib/auth/admin";

/**
 * GET SYNC HISTORY
 *
 * @route GET /api/admin/listing-scraper/history
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const authSupabase = await createServerSupabase();
    const activeSyncId = await syncStateManager.getActiveSyncId();

    // Fetch sync history from database
    const { data: history, error } = await authSupabase
      .from("listing_sync_history")
      .select(
        "id, started_at, completed_at, duration_ms, entities_processed, entities_created, entities_updated, entities_skipped, errors_count, status, config, error_message",
      )
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[LISTING SCRAPER] History query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 },
      );
    }

    // Transform to frontend format
    const formattedHistory = (history || []).map((record) => {
      const cfg =
        record.config && typeof record.config === "object"
          ? (record.config as Record<string, unknown>)
          : {};

      const warning =
        cfg.entity_fetch_warning && typeof cfg.entity_fetch_warning === "object"
          ? (cfg.entity_fetch_warning as Record<string, unknown>)
          : null;

      const offsetDiscovered =
        typeof warning?.fetchedCount === "number"
          ? warning.fetchedCount
          : record.entities_processed;

      const totalDiscovered =
        typeof cfg.total_entities === "number"
          ? cfg.total_entities
          : record.entities_processed;

      const fallbackDiscovered = Math.max(
        0,
        totalDiscovered - offsetDiscovered,
      );

      const staleRunning =
        record.status === "running" && activeSyncId !== record.id;

      return {
        id: record.id,
        startTime: record.started_at,
        endTime: record.completed_at || new Date().toISOString(),
        entitiesProcessed: record.entities_processed,
        entitiesCreated: record.entities_created,
        entitiesUpdated: record.entities_updated,
        errors: record.errors_count,
        status: staleRunning ? "failed" : record.status,
        staleRunning,
        staleMessage: staleRunning
          ? "Sync was interrupted (worker/session ended before completion)."
          : null,
        discoverySummary: `Discovery: offset ${offsetDiscovered.toLocaleString()} | fallback ${fallbackDiscovered.toLocaleString()} | total ${totalDiscovered.toLocaleString()}`,
        warningMessage:
          typeof warning?.message === "string" ? warning.message : null,
        errorMessage: record.error_message,
      };
    });

    return NextResponse.json({
      history: formattedHistory,
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: authStatus === 401 ? "Unauthorized" : "Forbidden" },
        { status: authStatus },
      );
    }

    const historyError = error as Error;
    console.error("[LISTING SCRAPER] History error:", historyError);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
