import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL environment variable is missing.");
}

// Clean the query parameters (e.g. sslmode=require) from connectionString to prevent pg driver
// from overriding the custom SSL configuration object below.
const cleanConnectionString = connectionString ? connectionString.split("?")[0] : undefined;

// Cache the pool on globalThis so Turbopack/webpack Fast Refresh reusing this
// module in dev doesn't spin up a new Pool (with its own min:2 warm
// connections) on every hot reload, leaking connections against DO's cap.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: cleanConnectionString,
    ssl: connectionString?.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,

    // Connection pool sizing
    // Next.js serverless: keep max low to avoid exhausting DO's 25-connection limit
    // across concurrent lambda invocations.
    max: 10,
    min: 2, // Keep a couple warm connections to avoid cold-start latency

    // How long (ms) a connection can sit idle before being closed.
    // 30s is a good balance — keeps connections warm without wasting resources.
    idleTimeoutMillis: 30_000,

    // How long (ms) to wait when acquiring a connection from the pool.
    // Fail fast instead of hanging indefinitely if DO is unreachable.
    connectionTimeoutMillis: 5_000,

    // Recycle connections after 7500 uses to prevent long-lived connection
    // memory leaks on the DO managed Postgres side.
    maxUses: 7_500,
  });
}

export const pool = global.__pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}


// Connection-level failures (never reached the server, so the query never
// ran) that are safe to retry once - as opposed to errors from a query that
// executed and failed, which must not be retried blindly.
const RETRYABLE_ERROR_PATTERNS = [
  "timeout exceeded when trying to connect",
  "Connection terminated due to connection timeout",
  "Connection terminated unexpectedly",
  "ECONNRESET",
  "EAI_AGAIN",
];

function isRetryableConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log("executed query", { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    if (isRetryableConnectionError(error)) {
      console.warn("query connection error, retrying once", { text, error });
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === "development") {
          console.log("executed query (retry)", { text, duration, rows: res.rowCount });
        }
        return res;
      } catch (retryError) {
        console.error("query error (after retry)", { text, error: retryError });
        throw retryError;
      }
    }
    console.error("query error", { text, error });
    throw error;
  }
}
