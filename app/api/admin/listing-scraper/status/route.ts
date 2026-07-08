import { NextRequest, NextResponse } from "next/server";
import { getWorkerConfig, requestWorker } from "@/lib/scraper/worker-client";
import * as Sentry from "@sentry/nextjs";
import {
  getAdminAuthErrorStatus,
  requireSuperAdmin,
} from "@/lib/auth/admin";

/**
 * GET SYNC STATUS
 *
 * @route GET /api/admin/listing-scraper/status
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
          error: "Worker status failed",
          message: `Worker responded with ${workerResponse.status}`,
        },
        { status: 502 },
      );
    }

    const status = await workerResponse.json();
    return NextResponse.json({
      ...status,
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

    const statusError = error as Error;
    console.error("[LISTING SCRAPER] Status error:", statusError);
    Sentry.captureException(statusError, {
      tags: {
        service: "next-app",
        operation: "listing_scraper_status_get",
      },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
