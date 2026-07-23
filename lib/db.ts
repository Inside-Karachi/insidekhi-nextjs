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
    max: process.env.NODE_ENV === "production" ? 10 : 4,
    min: process.env.NODE_ENV === "production" ? 2 : 0,

    // How long (ms) a connection can sit idle before being closed.
    idleTimeoutMillis: process.env.NODE_ENV === "production" ? 30_000 : 10_000,

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
  "Connection terminated",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
  "socket hang up",
  "connection to server was lost",
  "Client has encountered a connection error and is not queryable",
  "remaining connection slots are reserved",
];

// Standard Postgres connection-exception SQLSTATE codes (class 08) plus the
// admin/crash-shutdown and cannot-connect-now codes (57P01/57P02/57P03) -
// matching on these is more reliable than message text, which varies by
// driver version and can drift out of sync with RETRYABLE_ERROR_PATTERNS.
const RETRYABLE_ERROR_CODES = new Set([
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "08006", // connection_failure
  "08007", // transaction_resolution_unknown
  "53300", // too_many_connections / remaining connection slots reserved
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
]);

function isRetryableConnectionError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  if (code && RETRYABLE_ERROR_CODES.has(code)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export async function query(text: string, params?: unknown[]) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    if (isRetryableConnectionError(error)) {
      console.warn("query connection error, retrying once", { text, error });
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        const res = await pool.query(text, params);
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
