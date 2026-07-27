import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkerConfig, requestWorker } from "@/lib/scraper/worker-client";

export async function GET(_request: NextRequest) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden", message: "Only super admins can view worker health" },
        { status: 403 },
      );
    }

    const workerConfig = getWorkerConfig();
    if (!workerConfig.enabled) {
      return NextResponse.json({
        configured: false,
        executionMode: "external-worker-required",
        message:
          "SCRAPER_WORKER_URL is not configured. Local-process mode has been removed.",
      });
    }

    const workerResponse = await requestWorker(
      workerConfig,
      "/health",
      { method: "GET" },
      10000,
    );

    if (!workerResponse.ok) {
      return NextResponse.json(
        {
          configured: true,
          reachable: false,
          executionMode: "external-worker",
          message: `Worker responded with ${workerResponse.status}`,
        },
        { status: 502 },
      );
    }

    const body = await workerResponse.json();

    return NextResponse.json({
      configured: true,
      reachable: true,
      executionMode: "external-worker",
      worker: body,
    });
  } catch (error) {
    const healthError = error as Error;
    return NextResponse.json(
      {
        configured: true,
        reachable: false,
        executionMode: "external-worker",
        error: "Worker health check failed",
        message: healthError.message,
      },
      { status: 500 },
    );
  }
}
