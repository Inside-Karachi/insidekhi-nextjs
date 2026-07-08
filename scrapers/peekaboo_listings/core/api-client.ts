/**
 * PEEKABOO API CLIENT
 * Handles authentication, rate limiting, and HTTP requests to Peekaboo API
 */

import { chromium, type Browser } from "playwright";
import type {
  PeekabooEntityListResponse,
  PeekabooEntityDetailResponse,
  PeekabooBranchesResponse,
  PeekabooDealsResponse,
  ScraperContext,
} from "@/types/peekaboo-scraper.types";
import { SCRAPER_CONFIG, API_ENDPOINTS, DEFAULT_COORDINATES } from "../config";
import { updatePeekabooToken } from "@/lib/utils/peekaboo-token-manager";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  timeout?: number;
}

export class PeekabooAPIClient {
  private token: string | null = null;
  private browser: Browser | null = null;
  private requestQueue: Array<() => Promise<void>> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;

  constructor(private context: ScraperContext) {
    this.token = context.token;
  }

  /**
   * Authenticate and obtain an access token; persist it for reuse.
   */
  async authenticate(): Promise<string> {
    console.log("[AUTH] Authenticating with Peekaboo...");

    try {
      this.browser = await chromium.launch({ headless: true });
      const page = await this.browser.newPage();

      await page.goto(`${SCRAPER_CONFIG.baseUrl}/karachi`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      const token = await page.evaluate(() => {
        const raw = localStorage.getItem("peekaboo/AUTH_TOKEN");
        if (!raw) return null;

        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      });

      await this.browser.close();
      this.browser = null;

      if (!token) {
        throw new Error("Failed to extract auth token from localStorage");
      }

      this.token = token;
      this.context.token = token;

      // Persist to database for production use (works in both local and Vercel)
      await updatePeekabooToken(token);

      console.log("[AUTH] Authentication successful (token saved to DB)");
      return token;
    } catch (error) {
      if (this.browser) {
        await this.browser.close();
      }

      const authError = error as Error;
      console.error("[AUTH] Authentication failed:", authError.message);
      throw authError;
    }
  }

  /**
   * Rate limiter - enforces max requests per second
   */
  private async waitForRateLimit(): Promise<void> {
    const minInterval = 1000 / SCRAPER_CONFIG.rateLimit.requestsPerSecond;
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, minInterval - timeSinceLastRequest),
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Concurrent request limiter
   */
  private async waitForConcurrencySlot(): Promise<void> {
    while (this.activeRequests >= SCRAPER_CONFIG.rateLimit.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Generic HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { method = "POST", body, timeout = 30000 } = options;

    if (!this.token) {
      await this.authenticate();
    }

    await this.waitForRateLimit();
    await this.waitForConcurrencySlot();

    this.activeRequests++;

    try {
      const url = `${SCRAPER_CONFIG.baseUrl}${endpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Origin: SCRAPER_CONFIG.baseUrl,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.log("[AUTH] Token expired, regenerating...");
          await this.authenticate();
          return this.request<T>(endpoint, options);
        }

        if (response.status === 429) {
          throw new Error(`Rate limit exceeded`);
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const reqError = error as Error;
      console.error(`[API] Request failed: ${endpoint}`, reqError.message);
      throw reqError;
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async retryRequest<T>(
    fn: () => Promise<T>,
    context: string,
  ): Promise<T> {
    const { maxAttempts, backoffMs } = SCRAPER_CONFIG.retry;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const retryError = error as Error;

        if (attempt === maxAttempts - 1) {
          console.error(
            `[RETRY] ${context} failed after ${maxAttempts} attempts`,
          );
          throw retryError;
        }

        const delay = backoffMs[attempt] || backoffMs[backoffMs.length - 1];
        console.warn(
          `[RETRY] ${context} failed (attempt ${
            attempt + 1
          }/${maxAttempts}), retrying in ${delay}ms...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("Retry logic failed unexpectedly");
  }

  /**
   * Get all entities (listings) from Peekaboo
   */
  async getAllEntities(
    offset = 0,
    limit = 100,
  ): Promise<PeekabooEntityListResponse> {
    return this.retryRequest(
      () =>
        this.request<PeekabooEntityListResponse>(API_ENDPOINTS.entities, {
          method: "POST",
          body: {
            city: SCRAPER_CONFIG.city,
            country: SCRAPER_CONFIG.country,
            type: "all",
            limit,
            offset,
          },
        }),
      `getAllEntities(offset=${offset})`,
    );
  }

  /**
   * Discover entities via a query filter.
   */
  async getEntitiesByQuery(
    query: string,
    offset = 0,
    limit = 100,
  ): Promise<PeekabooEntityListResponse> {
    return this.retryRequest(
      () =>
        this.request<PeekabooEntityListResponse>(API_ENDPOINTS.entities, {
          method: "POST",
          body: {
            sortType: "trending",
            targetEntities: "_all",
            city: SCRAPER_CONFIG.city,
            country: SCRAPER_CONFIG.country,
            lat: DEFAULT_COORDINATES.lat,
            long: DEFAULT_COORDINATES.long,
            language: "en",
            categoryId: "_all",
            category: "All",
            limit,
            offset,
            query,
            sourceEntityId: "_all",
            atlId: "_all",
          },
        }),
      `getEntitiesByQuery(query=${query},offset=${offset})`,
    );
  }

  /**
   * Get detailed information for a specific entity
   */
  async getEntityDetail(
    entityId: number,
    slug?: string,
  ): Promise<PeekabooEntityDetailResponse> {
    return this.retryRequest(
      () =>
        this.request<PeekabooEntityDetailResponse>(API_ENDPOINTS.entityDetail, {
          body: {
            entityId,
            name: slug,
            city: SCRAPER_CONFIG.city,
            country: SCRAPER_CONFIG.country,
            type: "merchant",
          },
        }),
      `getEntityDetail(${entityId})`,
    );
  }

  /**
   * Get all branches/locations for an entity
   */
  async getEntityBranches(entityId: number): Promise<PeekabooBranchesResponse> {
    return this.retryRequest(
      () =>
        this.request<PeekabooBranchesResponse>(API_ENDPOINTS.branches, {
          body: {
            entityId,
            city: SCRAPER_CONFIG.city,
            country: SCRAPER_CONFIG.country,
            lat: DEFAULT_COORDINATES.lat,
            long: DEFAULT_COORDINATES.long,
            limit: 100,
            offset: 0,
            language: "en",
          },
        }),
      `getEntityBranches(${entityId})`,
    );
  }

  /**
   * Get bank/card deals for an entity (merchant)
   */
  async getEntityDeals(entityId: number): Promise<PeekabooDealsResponse> {
    return this.retryRequest(
      () =>
        this.request<PeekabooDealsResponse>(API_ENDPOINTS.deals, {
          body: {
            city: SCRAPER_CONFIG.city,
            country: SCRAPER_CONFIG.country,
            lat: DEFAULT_COORDINATES.lat,
            long: DEFAULT_COORDINATES.long,
            language: "en",
            offset: 0,
            limit: 100,
            associatedDeals: true,
            targetEntityId: entityId.toString(),
            card: "All",
            targetBranchId: "_all",
            atlId: "_all",
          },
        }),
      `getEntityDeals(${entityId})`,
    );
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Factory function to create authenticated API client
 */
export async function createAPIClient(
  context: ScraperContext,
): Promise<PeekabooAPIClient> {
  const client = new PeekabooAPIClient(context);

  if (!context.token) {
    await client.authenticate();
  }

  return client;
}
