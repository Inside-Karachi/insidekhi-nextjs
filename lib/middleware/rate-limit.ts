/**
 * Rate Limiting Middleware for API Routes
 * Easy integration wrapper for Next.js API routes
 */

import { NextResponse } from "next/server";
import { checkRateLimit } from "../security/rate-limiter";

export interface RateLimitMiddlewareConfig {
  /**
   * Maximum requests allowed in the time window
   * @default 100
   */
  limit?: number;

  /**
   * Time window in milliseconds
   * @default 3600000 (1 hour)
   */
  windowMs?: number;

  /**
   * Custom endpoint name for logging
   */
  endpoint?: string;

  /**
   * Skip security event logging (for public endpoints)
   * @default false
   */
  skipLogging?: boolean;

  /**
   * Custom error message
   */
  message?: string;
}

// Rate limit middleware for API routes.
export async function withRateLimit(
  request: Request,
  config: RateLimitMiddlewareConfig = {},
): Promise<{
  allowed: boolean;
  response?: NextResponse;
  remaining: number;
  resetTime: number;
}> {
  const result = await checkRateLimit(request, config);

  if (!result.allowed) {
    const resetDate = new Date(result.resetTime);
    const message = result.isBlocked
      ? "IP address temporarily blocked due to excessive requests"
      : config.message || "Too many requests, please try again later";

    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (result.resetTime - Date.now()) / 1000,
            ).toString(),
            "X-RateLimit-Limit": (config.limit || 100).toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetDate.toISOString(),
          },
        },
      ),
      remaining: 0,
      resetTime: result.resetTime,
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetTime: result.resetTime,
  };
}

/**
 * Preset configurations for common scenarios
 */
export const RateLimitPresets = {
  /**
   * Strict limits for authentication endpoints
   */
  AUTH: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  /**
   * Standard limits for admin API routes
   */
  ADMIN_API: {
    limit: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  /**
   * Relaxed limits for public API routes
   */
  PUBLIC_API: {
    limit: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  /**
   * Very strict limits for expensive operations
   */
  EXPENSIVE: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  /**
   * Limits for file uploads
   */
  UPLOAD: {
    limit: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
} as const;
