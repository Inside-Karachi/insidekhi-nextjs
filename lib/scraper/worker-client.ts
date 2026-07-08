import * as Sentry from "@sentry/nextjs";

export interface WorkerClientConfig {
  enabled: boolean;
  workerUrl: string;
  workerSecret: string;
}

export function getWorkerConfig(): WorkerClientConfig {
  const workerUrl = process.env.SCRAPER_WORKER_URL?.trim() || "";
  const workerSecret = process.env.SCRAPER_WORKER_SECRET?.trim() || "";

  return {
    enabled: workerUrl.length > 0,
    workerUrl: workerUrl.replace(/\/$/, ""),
    workerSecret,
  };
}

export async function requestWorker(
  config: WorkerClientConfig,
  path: string,
  init?: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init?.headers || {});
    headers.set("x-worker-secret", config.workerSecret);

    return await fetch(`${config.workerUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        service: "next-app",
        operation: "worker_client_request",
        workerPath: path,
      },
      extra: {
        method: init?.method || "GET",
      },
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
