#!/usr/bin/env tsx
/**
 * SIGNAL HANDLER SETUP
 *
 * Handles graceful shutdown for localhost scraper when:
 * - User presses Ctrl+C (SIGINT)
 * - System sends termination signal (SIGTERM)
 * - UPS shutdown (SIGUSR1/SIGUSR2)
 *
 * Ensures current chunk is completed and progress is saved before exit.
 */

import { syncStateManager } from "@/lib/scraper/redis-state-manager";

let shutdownInProgress = false;

/**
 * Graceful shutdown handler
 */
function handleShutdown(signal: string) {
  if (shutdownInProgress) {
    console.log(`\n[SHUTDOWN] Already shutting down... (${signal} ignored)`);
    return;
  }

  shutdownInProgress = true;

  console.log(`\n[SHUTDOWN] Received ${signal} - initiating graceful stop`);
  console.log("[SHUTDOWN] Current batch will complete, then scraper will exit");
  console.log("[SHUTDOWN] Progress is saved every 10 entities (checkpoints)");
  console.log(
    "[SHUTDOWN] You can resume later - processed entities will be skipped\n",
  );

  // Request graceful stop
  void syncStateManager.requestStop();

  // Give scraper 30 seconds to finish current batch
  setTimeout(() => {
    console.log("[SHUTDOWN] Timeout reached. Forcing exit...");
    process.exit(0);
  }, 30000);
}

/**
 * Setup signal handlers
 * Call this at the start of your scraper
 */
export function setupSignalHandlers() {
  // Ctrl+C on Windows/Linux/Mac
  process.on("SIGINT", () => handleShutdown("SIGINT (Ctrl+C)"));

  // Kill command or system shutdown
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));

  // UPS shutdown warnings (Linux/Unix)
  process.on("SIGUSR1", () => handleShutdown("SIGUSR1"));
  process.on("SIGUSR2", () => handleShutdown("SIGUSR2"));

  console.log("[SIGNAL] Graceful shutdown handlers registered");
  console.log("[SIGNAL] Press Ctrl+C anytime to stop gracefully\n");
}

/**
 * Cleanup handler for normal exit
 */
export function setupExitHandler() {
  process.on("exit", (code) => {
    if (shutdownInProgress) {
      console.log(`[EXIT] Scraper stopped gracefully (code: ${code})`);
    }
  });
}
