/**
 * Distributed Rate Limiter using Upstash Redis
 * Replaces in-memory implementation for serverless environments
 *
 * CRITICAL: This solves the Lambda isolation problem where each
 * serverless instance has its own memory, making in-memory rate
 * limiting ineffective at scale.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis connection (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env)
const redis = Redis.fromEnv();

// Rate limiter configurations for different endpoints
export const rateLimiters = {
  // Authentication endpoints - strict limits to prevent brute force
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 requests per 15 minutes
    prefix: "@upstash/ratelimit/auth",
    analytics: true,
  }),

  // API endpoints - general rate limiting
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
    prefix: "@upstash/ratelimit/api",
    analytics: true,
  }),

  // Contact/newsletter forms - moderate limits
  forms: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 submissions per hour
    prefix: "@upstash/ratelimit/forms",
    analytics: true,
  }),

  // Ticket checkout - balanced between UX and abuse prevention
  checkout: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "5 m"), // 10 checkout attempts per 5 minutes
    prefix: "@upstash/ratelimit/checkout",
    analytics: true,
  }),

  // Admin operations - higher limits for authenticated admins
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, "1 m"), // 200 requests per minute
    prefix: "@upstash/ratelimit/admin",
    analytics: true,
  }),
};

/**
 * Rate limit check result interface
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending?: Promise<unknown>;
}

/**
 * Helper function to get IP address from request
 */
function getIpAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return "127.0.0.1"; // Fallback for local development
}

/**
 * Check rate limit for authentication endpoints
 * Uses IP address as identifier to prevent brute force attacks
 */
export async function checkAuthRateLimit(
  request: Request
): Promise<RateLimitResult> {
  const ip = getIpAddress(request);
  const identifier = `auth:${ip}`;

  const result = await rateLimiters.auth.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    pending: result.pending,
  };
}

/**
 * Check rate limit for general API endpoints
 * Uses IP address as identifier
 */
export async function checkApiRateLimit(
  request: Request,
  customIdentifier?: string
): Promise<RateLimitResult> {
  const ip = getIpAddress(request);
  const identifier = customIdentifier || `api:${ip}`;

  const result = await rateLimiters.api.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    pending: result.pending,
  };
}

/**
 * Check rate limit for form submissions (contact, newsletter, etc.)
 * Uses email or IP address as identifier
 */
export async function checkFormRateLimit(
  request: Request,
  email?: string
): Promise<RateLimitResult> {
  const ip = getIpAddress(request);
  const identifier = email ? `form:${email}` : `form:${ip}`;

  const result = await rateLimiters.forms.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    pending: result.pending,
  };
}

/**
 * Check rate limit for checkout operations
 * Uses user ID or IP address as identifier
 */
export async function checkCheckoutRateLimit(
  request: Request,
  userId?: string
): Promise<RateLimitResult> {
  const ip = getIpAddress(request);
  const identifier = userId ? `checkout:${userId}` : `checkout:${ip}`;

  const result = await rateLimiters.checkout.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    pending: result.pending,
  };
}

/**
 * Check rate limit for admin operations
 * Uses admin user ID as identifier
 */
export async function checkAdminRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const identifier = `admin:${userId}`;

  const result = await rateLimiters.admin.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    pending: result.pending,
  };
}

/**
 * Manually reset rate limit for a specific identifier
 * Useful for admin overrides or after resolving false positives
 */
export async function resetRateLimit(
  limiterType: keyof typeof rateLimiters,
  identifier: string
): Promise<void> {
  const ratelimiter = rateLimiters[limiterType];
  await ratelimiter.resetUsedTokens(identifier);
}

/**
 * Get remaining quota for a specific identifier without consuming tokens
 * Useful for displaying quota information to users
 */
export async function getRemainingQuota(
  limiterType: keyof typeof rateLimiters,
  identifier: string
): Promise<{ remaining: number; reset: number }> {
  const ratelimiter = rateLimiters[limiterType];
  const result = await ratelimiter.getRemaining(identifier);

  return {
    remaining: result.remaining,
    reset: result.reset,
  };
}

// Legacy compatibility - export default instance for gradual migration
export const distributedRateLimiter = rateLimiters.api;

/**
 * Helper to create rate limit response
 */
export function createRateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

  return {
    error: "Too many requests. Please try again later.",
    retryAfter,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: new Date(result.reset).toISOString(),
  };
}
