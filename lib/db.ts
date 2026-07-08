import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL environment variable is missing.");
}

// Clean the query parameters (e.g. sslmode=require) from connectionString to prevent pg driver
// from overriding the custom SSL configuration object below.
const cleanConnectionString = connectionString ? connectionString.split("?")[0] : undefined;

export const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: connectionString?.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

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
    console.error("query error", { text, error });
    throw error;
  }
}
