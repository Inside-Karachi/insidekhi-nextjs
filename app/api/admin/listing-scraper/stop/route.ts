import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkerConfig, requestWorker } from "@/lib/scraper/worker-client";

/**
 * GRACEFUL STOP ENDPOINT
 *
 * Stops the running sync operation gracefully (completes current batch)
 *
 * Security: Requires super_admin role
 *
 * @route POST /api/admin/listing-scraper/stop
 */
export async function POST(_request: NextRequest) {
  try {
    const authSupabase = await createServerSupabase();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check super_admin role
    const { data: profile } = await authSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { enabled, workerUrl, workerSecret } = getWorkerConfig();

    if (!enabled) {
      return NextResponse.json(
        {
          error: "Worker not configured",
          message:
            "SCRAPER_WORKER_URL is required. Local-process mode has been removed.",
        },
        { status: 503 },
      );
    }

    const workerResponse = await requestWorker(
      { enabled, workerUrl, workerSecret },
      "/sync/stop",
      { method: "POST" },
    );

    if (!workerResponse.ok) {
      const workerBody = await workerResponse.text();
      return NextResponse.json(
        {
          error: "Worker stop failed",
          message: workerBody || `Worker responded with ${workerResponse.status}`,
        },
        { status: 502 },
      );
    }

    const body = await workerResponse.json();
    return NextResponse.json({
      ...body,
      executionMode: "external-worker",
    });
  } catch (error) {
    const stopError = error as Error;
    console.error("[SYNC STOP] Error:", stopError);

    return NextResponse.json(
      { error: "Internal server error", message: stopError.message },
      { status: 500 },
    );
  }
}
