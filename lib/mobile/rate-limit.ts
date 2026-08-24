import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { MobileApiError } from "./errors";

/**
 * Dedicated rate-limit tier for the mobile API. A separate Upstash prefix keeps
 * app traffic isolated from the website's limits (independent kill switch /
 * throttle, per the access plan section 7).
 *
 * Built lazily and fail-open when Upstash env is absent (e.g. local/sandbox
 * without Redis configured) so development isn't blocked; production always has
 * the env set.
 */
let limiter: Ratelimit | null = null;
let initialized = false;

/**
 * True when Upstash is configured. Fail CLOSED in production (a missing config
 * is a loud error, not a silent removal of throttling); fail open in dev/sandbox
 * so local work isn't blocked when Redis isn't configured.
 */
function redisAvailable(): boolean {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return true;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Mobile rate limiter requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production",
    );
  }
  console.warn(
    "[mobile-api] Upstash env not set - rate limiting disabled (dev/sandbox).",
  );
  return false;
}

function getLimiter(): Ratelimit | null {
  if (initialized) return limiter;
  // Resolve availability BEFORE latching: a prod misconfig (redisAvailable
  // throws) must fail closed on every call, not cache a fail-open null.
  const available = redisAvailable();
  initialized = true;
  if (!available) return null;

  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "@upstash/ratelimit/mobile",
    analytics: true,
  });
  return limiter;
}

// Independent, stricter tier for the unauthenticated resend-verification
// endpoint: 3 per hour per email (contract section 2.2), separate prefix so it doesn't
// share a window with the general 120/min limiter.
let verifyLimiter: Ratelimit | null = null;
let verifyInitialized = false;

function getVerifyLimiter(): Ratelimit | null {
  if (verifyInitialized) return verifyLimiter;
  const available = redisAvailable();
  verifyInitialized = true;
  if (!available) return null;

  verifyLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "@upstash/ratelimit/mobile-verify",
    analytics: true,
  });
  return verifyLimiter;
}

// Stricter tier for the authenticated password-change endpoint: 5 per 15 min
// per user, so a stolen access token can't be used to brute-force the current
// password (which the change requires) within the general 120/min budget.
let passwordLimiter: Ratelimit | null = null;
let passwordInitialized = false;

function getPasswordLimiter(): Ratelimit | null {
  if (passwordInitialized) return passwordLimiter;
  const available = redisAvailable();
  passwordInitialized = true;
  if (!available) return null;

  passwordLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "@upstash/ratelimit/mobile-password",
    analytics: true,
  });
  return passwordLimiter;
}

// Stricter tier for POST /checkout: 10 per 5 minutes per user (contract section 9), so
// booking creation can't be flooded even within the general 120/min budget.
let checkoutLimiter: Ratelimit | null = null;
let checkoutInitialized = false;

function getCheckoutLimiter(): Ratelimit | null {
  if (checkoutInitialized) return checkoutLimiter;
  const available = redisAvailable();
  checkoutInitialized = true;
  if (!available) return null;

  checkoutLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "5 m"),
    prefix: "@upstash/ratelimit/mobile-checkout",
    analytics: true,
  });
  return checkoutLimiter;
}

// Dedicated tier for POST /organizer/tickets/verify: 60 per minute per user,
// generous enough for rapid door-scanning across multiple gates while still
// bounding abuse (e.g. a compromised token brute-forcing ticket codes).
let ticketVerifyLimiter: Ratelimit | null = null;
let ticketVerifyInitialized = false;

function getTicketVerifyLimiter(): Ratelimit | null {
  if (ticketVerifyInitialized) return ticketVerifyLimiter;
  const available = redisAvailable();
  ticketVerifyInitialized = true;
  if (!available) return null;

  ticketVerifyLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "@upstash/ratelimit/mobile-ticket-verify",
    analytics: true,
  });
  return ticketVerifyLimiter;
}

function getIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

/**
 * Enforces the mobile rate limit. Pass a stable `identifier` (e.g. the user id)
 * for authenticated routes; otherwise the caller IP is used. Throws
 * `rate_limited` (429) with `meta.retryAfter` when exceeded.
 */
export async function enforceMobileRateLimit(
  request: Request,
  identifier?: string,
): Promise<void> {
  const rl = getLimiter();
  if (!rl) return;

  const key = `mobile:${identifier ?? `ip:${getIp(request)}`}`;
  const result = await rl.limit(key);

  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    throw new MobileApiError(
      "rate_limited",
      "Too many requests. Please try again later.",
      429,
      undefined,
      { retryAfter },
    );
  }
}

/**
 * Per-email throttle for POST /auth/resend-verification (3 / hour / email).
 * No-ops when Upstash isn't configured (dev/sandbox); throws 429 with
 * `meta.retryAfter` when exceeded.
 */
export async function enforceResendVerificationLimit(
  email: string,
): Promise<void> {
  const rl = getVerifyLimiter();
  if (!rl) return;

  const result = await rl.limit(`verify:${email}`);
  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    throw new MobileApiError(
      "rate_limited",
      "Too many verification emails requested. Please try again later.",
      429,
      undefined,
      { retryAfter },
    );
  }
}

/**
 * Stricter throttle for POST /profile/password (5 / 15 min / user). Bounds
 * brute-forcing of the current password a token-holder must supply to change it.
 */
export async function enforcePasswordChangeLimit(
  userId: string,
): Promise<void> {
  const rl = getPasswordLimiter();
  if (!rl) return;

  const result = await rl.limit(`password:${userId}`);
  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    throw new MobileApiError(
      "rate_limited",
      "Too many password change attempts. Please try again later.",
      429,
      undefined,
      { retryAfter },
    );
  }
}

/** Throttle for POST /checkout (10 / 5 min / user). */
export async function enforceCheckoutRateLimit(userId: string): Promise<void> {
  const rl = getCheckoutLimiter();
  if (!rl) return;

  const result = await rl.limit(`checkout:${userId}`);
  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    throw new MobileApiError(
      "rate_limited",
      "Too many checkout attempts. Please try again later.",
      429,
      undefined,
      { retryAfter },
    );
  }
}

/** Throttle for POST /organizer/tickets/verify (60 / min / user). */
export async function enforceTicketVerifyRateLimit(
  userId: string,
): Promise<void> {
  const rl = getTicketVerifyLimiter();
  if (!rl) return;

  const result = await rl.limit(`ticket-verify:${userId}`);
  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    throw new MobileApiError(
      "rate_limited",
      "Too many check-in attempts. Please slow down.",
      429,
      undefined,
      { retryAfter },
    );
  }
}
