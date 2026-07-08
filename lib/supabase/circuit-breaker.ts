/**
 * Circuit Breaker Pattern for Supabase Calls
 * Prevents cascade failures when Supabase is slow or unavailable
 *
 * CRITICAL: In serverless environments, if Supabase times out,
 * all Lambda instances can get stuck waiting, causing site-wide failures.
 * This circuit breaker fails fast and provides fallback responses.
 */

import CircuitBreaker from "opossum";
import { SupabaseClient } from "@supabase/supabase-js";

// Circuit breaker options
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 10000, // 10 seconds - fail if operation takes longer
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 60000, // Track failures over 60 second window
  rollingCountBuckets: 10, // Divide window into 10 buckets
  name: "supabase-circuit-breaker",
};

interface CircuitBreakerStats {
  isOpen: boolean;
  failures: number;
  successes: number;
  rejects: number;
  timeouts: number;
}

/**
 * Create a circuit breaker for Supabase operations
 */
export function createSupabaseCircuitBreaker<T>(
  operation: () => Promise<T>,
  operationName = "supabase-operation"
): CircuitBreaker<[], T> {
  const breaker = new CircuitBreaker<[], T>(async () => operation(), {
    ...CIRCUIT_BREAKER_OPTIONS,
    name: operationName,
  });

  // Event handlers for monitoring
  breaker.on("open", () => {
    console.warn(
      `[CIRCUIT BREAKER] ${operationName} - Circuit opened (too many failures)`
    );
  });

  breaker.on("halfOpen", () => {
    console.log(
      `[CIRCUIT BREAKER] ${operationName} - Circuit half-open (testing recovery)`
    );
  });

  breaker.on("close", () => {
    console.log(
      `[CIRCUIT BREAKER] ${operationName} - Circuit closed (recovered)`
    );
  });

  breaker.on("timeout", () => {
    console.error(`[CIRCUIT BREAKER] ${operationName} - Operation timed out`);
  });

  breaker.on("reject", () => {
    console.warn(
      `[CIRCUIT BREAKER] ${operationName} - Request rejected (circuit open)`
    );
  });

  return breaker;
}

/**
 * Wrapper for Supabase query operations with circuit breaker
 * Usage: const result = await withCircuitBreaker(() => supabase.from('table').select())
 */
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  operationName = "supabase-query"
): Promise<T> {
  const breaker = createSupabaseCircuitBreaker(operation, operationName);

  try {
    const result = await breaker.fire();
    return result;
  } catch (error) {
    // Circuit breaker errors
    if (error instanceof Error) {
      if (error.message.includes("Breaker is open")) {
        console.error(
          `[CIRCUIT BREAKER] ${operationName} - Circuit is open, rejecting request`
        );
        throw new Error(
          "Service temporarily unavailable. Please try again in a moment."
        );
      }

      if (error.message.includes("Timed out")) {
        console.error(`[CIRCUIT BREAKER] ${operationName} - Request timed out`);
        throw new Error("Request timed out. Please try again.");
      }
    }

    // Re-throw original error
    throw error;
  }
}

/**
 * Wrapper for Supabase operations with fallback value
 * If circuit breaker trips, returns fallback instead of throwing
 */
export async function withCircuitBreakerFallback<T>(
  operation: () => Promise<T>,
  fallback: T,
  operationName = "supabase-query"
): Promise<T> {
  try {
    return await withCircuitBreaker(operation, operationName);
  } catch (error) {
    console.warn(
      `[CIRCUIT BREAKER] ${operationName} - Using fallback value due to error:`,
      error
    );
    return fallback;
  }
}

/**
 * Get circuit breaker stats for monitoring
 */
export function getCircuitBreakerStats(
  breaker: CircuitBreaker
): CircuitBreakerStats {
  const stats = breaker.stats;

  return {
    isOpen: breaker.opened,
    failures: stats.failures,
    successes: stats.successes,
    rejects: stats.rejects,
    timeouts: stats.timeouts,
  };
}

/**
 * Manually force circuit breaker to specific state
 * Useful for testing or emergency overrides
 */
export function forceCircuitBreakerState(
  breaker: CircuitBreaker,
  state: "open" | "close"
): void {
  if (state === "open") {
    breaker.open();
    console.log("[CIRCUIT BREAKER] Manually opened circuit");
  } else {
    breaker.close();
    console.log("[CIRCUIT BREAKER] Manually closed circuit");
  }
}

/**
 * Example usage patterns
 */
export const circuitBreakerExamples = {
  // Simple query with circuit breaker
  simpleQuery: async (supabase: SupabaseClient) => {
    return withCircuitBreaker(async () => {
      const result = await supabase.from("events").select("*").limit(10);
      return result;
    }, "fetch-events");
  },

  // Query with fallback (returns empty result on failure)
  queryWithFallback: async (supabase: SupabaseClient) => {
    return withCircuitBreakerFallback(
      async () => {
        const result = await supabase.from("events").select("*").limit(10);
        return result;
      },
      { data: [], error: null, count: null, status: 200, statusText: "OK" },
      "fetch-events-safe"
    );
  },

  // Insert operation
  insertWithCircuitBreaker: async (supabase: SupabaseClient, data: unknown) => {
    return withCircuitBreaker(async () => {
      const result = await supabase.from("bookings").insert(data);
      return result;
    }, "create-booking");
  },
};
