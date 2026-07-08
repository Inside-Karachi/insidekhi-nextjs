import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { startScraperWorker } from "./worker-runtime";
import {
  captureWorkerException,
  initWorkerSentry,
  redactForLog,
  Sentry,
} from "@/lib/sentry/worker-sentry";

const currentDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(currentDir, "../../..");

loadEnv({ path: resolve(monorepoRoot, ".env.local") });
initWorkerSentry();

const port = Number(process.env.PORT || "8787");

void startScraperWorker(port).catch((error) => {
  console.error("[WORKER] Failed to start worker:", redactForLog(error));
  captureWorkerException(error, { stage: "worker_startup" });
  process.exitCode = 1;
});

/**
 * Default: log + Sentry, keep process alive (24/7). Rejections from flaky deps
 * should not take down the whole worker. Set SCRAPER_EXIT_ON_UNHANDLED_REJECTION=true
 * to exit after flush (e.g. strict environments).
 */
process.on("unhandledRejection", (reason) => {
  console.error("[WORKER] unhandledRejection:", redactForLog(reason));
  captureWorkerException(reason, { stage: "unhandled_rejection" });
  if (process.env.SCRAPER_EXIT_ON_UNHANDLED_REJECTION === "true") {
    void Sentry.close(2000).finally(() => {
      process.exit(1);
    });
  }
});

process.on("uncaughtException", (error) => {
  console.error("[WORKER] uncaughtException:", redactForLog(error));
  captureWorkerException(error, { stage: "uncaught_exception" });
  void Sentry.close(2000).finally(() => {
    process.exit(1);
  });
});
