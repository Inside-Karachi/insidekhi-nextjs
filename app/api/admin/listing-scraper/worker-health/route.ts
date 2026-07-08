import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkerConfig, requestWorker } from "@/lib/scraper/worker-client";

export async function GET(_request: NextRequest) {
  try {
    const authSupabase = await createServerSupabase();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await authSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
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
