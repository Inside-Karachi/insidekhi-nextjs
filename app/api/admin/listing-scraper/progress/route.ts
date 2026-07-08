import { NextRequest, NextResponse } from "next/server";
import { getWorkerConfig, requestWorker } from "@/lib/scraper/worker-client";
import * as Sentry from "@sentry/nextjs";
import {
  getAdminAuthErrorStatus,
  requireSuperAdmin,
} from "@/lib/auth/admin";

/**
 * GET SYNC PROGRESS
 *
 * @route GET /api/admin/listing-scraper/progress
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

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
      "/sync/status",
      { method: "GET" },
    );

    if (!workerResponse.ok) {
      return NextResponse.json(
        {
          error: "Worker progress failed",
          message: `Worker responded with ${workerResponse.status}`,
        },
        { status: 502 },
      );
    }

    const status = (await workerResponse.json()) as {
      status?: string;
      progress?: unknown;
    };

    return NextResponse.json({
      progress: status.progress ?? null,
      status: status.status ?? "idle",
      executionMode: "external-worker",
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: authStatus === 401 ? "Unauthorized" : "Forbidden" },
        { status: authStatus },
      );
    }

    const progressError = error as Error;
    console.error("[LISTING SCRAPER] Progress error:", progressError);
    Sentry.captureException(progressError, {
      tags: {
        service: "next-app",
        operation: "listing_scraper_progress_get",
      },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
