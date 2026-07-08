/**
 * PEEKABOO TOKEN MANAGER
 *
 * Manages authentication token with production-ready fallback hierarchy:
 * 1. Database (system_config) - Primary source, auto-updated
 * 2. Environment Variable - Fallback for initial setup
 * 3. Playwright Auto-Extract - Last resort for regeneration
 *
 * Works in both local dev and Vercel production.
 */

import { chromium, type Browser } from "playwright";
import { createClient } from "@supabase/supabase-js";

const TOKEN_KEY = "peekaboo_auth_token";
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

interface TokenCache {
  value: string;
  timestamp: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get Supabase client with service role (bypasses RLS)
 */
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Fetch token from database
 */
async function getTokenFromDatabase(): Promise<string | null> {
  console.log("[TOKEN] Checking database...");

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("system_config")
      .select("config_value")
      .eq("config_key", TOKEN_KEY)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        console.log("[TOKEN] No token found in database (first run)");
      } else {
        console.warn("[TOKEN] Database fetch failed:", error.message);
      }
      return null;
    }

    if (!data?.config_value) {
      console.log("[TOKEN] No token found in database");
      return null;
    }

    // Extract token from JSONB (stored as { "token": "..." })
    const tokenValue =
      typeof data.config_value === "object" && data.config_value !== null
        ? (data.config_value as { token?: string }).token
        : null;

    if (!tokenValue) {
      console.warn("[TOKEN] Invalid token format in database");
      return null;
    }

    console.log("[TOKEN] Retrieved from database");
    return tokenValue;
  } catch (error) {
    console.error("[TOKEN] Database error:", error);
    return null;
  }
}

/**
 * Save token to database
 */
async function saveTokenToDatabase(token: string): Promise<boolean> {
  console.log("[TOKEN] Saving to database...");

  try {
    const supabase = getServiceClient();

    const { error } = await supabase.from("system_config").upsert(
      {
        config_key: TOKEN_KEY,
        config_value: { token },
        config_type: "setting",
        is_public: false,
        description: "Peekaboo.guru API authentication token (auto-managed)",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "config_key",
      },
    );

    if (error) {
      console.error("[TOKEN] Database save failed:", error.message);
      return false;
    }

    console.log("[TOKEN] Saved to database successfully");
    return true;
  } catch (error) {
    console.error("[TOKEN] Database save error:", error);
    return false;
  }
}

/**
 * Extract fresh token using Playwright
 */
async function extractTokenWithPlaywright(): Promise<string | null> {
  console.log("[TOKEN] Extracting fresh token via Playwright...");

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      timeout: 60000,
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    await page.goto("https://peekaboo.guru/karachi/restaurants", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    const token = await page.evaluate(() => {
      const raw = localStorage.getItem("peekaboo/AUTH_TOKEN");
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "string" ? parsed : null;
      } catch {
        return typeof raw === "string" ? raw : null;
      }
    });

    if (!token) {
      console.error(
        "[TOKEN] Failed to extract token. Peekaboo may have changed their auth mechanism.",
      );
      return null;
    }

    console.log(
      `[TOKEN] Extracted token: ${token.substring(0, 20)}...${token.substring(token.length - 10)}`,
    );

    return token;
  } catch (error) {
    console.error("[TOKEN] Playwright extraction failed:", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Get token with fallback hierarchy:
 * 1. In-memory cache (5 min TTL)
 * 2. Database (system_config table)
 * 3. Environment variable (PEEKABOO_AUTH_TOKEN)
 * 4. Playwright auto-extract (local only, if autoRegenerate=true)
 */
export async function getPeekabooToken(
  options: { autoRegenerate?: boolean } = {},
): Promise<string> {
  const { autoRegenerate = false } = options;

  console.log("[TOKEN] Fetching authentication token...");

  // Check in-memory cache first (performance optimization)
  if (tokenCache && Date.now() - tokenCache.timestamp < TOKEN_CACHE_TTL) {
    console.log(
      "[TOKEN] Using cached token (age: " +
        Math.floor((Date.now() - tokenCache.timestamp) / 1000) +
        "s)",
    );
    return tokenCache.value;
  }

  // Try database first (primary source for production)
  const dbToken = await getTokenFromDatabase();
  if (dbToken) {
    console.log("[TOKEN] Token loaded from database");
    tokenCache = { value: dbToken, timestamp: Date.now() };
    return dbToken;
  }

  // Fallback to environment variable
  console.log("[TOKEN] Checking environment variable...");
  const envToken = process.env.PEEKABOO_AUTH_TOKEN;
  if (envToken) {
    console.log("[TOKEN] Found token in environment variable");
    console.log("[TOKEN] Migrating to database for future runs...");

    // Proactively save to database for future runs
    const saved = await saveTokenToDatabase(envToken);
    if (saved) {
      console.log("[TOKEN] Migration complete - future runs will use database");
    } else {
      console.warn("[TOKEN] Migration failed, will continue using env var");
    }

    tokenCache = { value: envToken, timestamp: Date.now() };
    return envToken;
  }

  // Last resort: Auto-regenerate (local only)
  if (autoRegenerate) {
    console.log(
      "[TOKEN] No token found in DB or env. Attempting auto-regeneration...",
    );

    const freshToken = await extractTokenWithPlaywright();
    if (freshToken) {
      await saveTokenToDatabase(freshToken);
      tokenCache = { value: freshToken, timestamp: Date.now() };
      return freshToken;
    }
  }

  // Final error
  const errorMsg =
    "Peekaboo token not found. Run 'npm run extract:peekaboo-token' or set PEEKABOO_AUTH_TOKEN in .env.local";

  console.error("[TOKEN] FATAL:", errorMsg);
  throw new Error(errorMsg);
}

/**
 * Save a freshly regenerated token to database
 * Called by api-client.ts when 401/403 errors trigger re-authentication
 */
export async function updatePeekabooToken(token: string): Promise<void> {
  console.log("[TOKEN] Updating token after re-authentication...");

  const saved = await saveTokenToDatabase(token);

  if (saved) {
    // Update cache
    tokenCache = { value: token, timestamp: Date.now() };
    console.log("[TOKEN] Token updated and cached successfully");
  } else {
    console.error(
      "[TOKEN] Failed to save token to database (will retry next time)",
    );
    // Still update cache even if DB save failed
    tokenCache = { value: token, timestamp: Date.now() };
  }
}

/**
 * Clear cache (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  console.log("[TOKEN] Cache cleared");
}

/**
 * Get token metadata (for debugging/monitoring)
 */
export async function getTokenMetadata(): Promise<{
  source: "cache" | "database" | "env" | "none";
  lastUpdated: string | null;
}> {
  // Check cache
  if (tokenCache && Date.now() - tokenCache.timestamp < TOKEN_CACHE_TTL) {
    return {
      source: "cache",
      lastUpdated: new Date(tokenCache.timestamp).toISOString(),
    };
  }

  // Check database
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("system_config")
      .select("updated_at")
      .eq("config_key", TOKEN_KEY)
      .single();

    if (data) {
      return {
        source: "database",
        lastUpdated: data.updated_at || null,
      };
    }
  } catch {
    // Silent fail
  }

  // Check env
  if (process.env.PEEKABOO_AUTH_TOKEN) {
    return {
      source: "env",
      lastUpdated: null,
    };
  }

  return {
    source: "none",
    lastUpdated: null,
  };
}
