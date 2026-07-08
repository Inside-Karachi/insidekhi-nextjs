/**
 * Rate limiter with security event logging
 * Integrates with Security Center for violation tracking and auto-blocking
 */

import { logSecurityEvent } from "./events";

interface RateLimitEntry {
  count: number;
  resetTime: number;
  violations: number; // Track cumulative violations
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  isBlocked?: boolean;
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
  endpoint?: string;
  skipLogging?: boolean;
}

class EnhancedRateLimiter {
  private cache: Map<string, RateLimitEntry> = new Map();
  private blockedIPs: Map<string, number> = new Map(); // IP -> unblock timestamp
  private cleanupInterval: NodeJS.Timeout;

  // Configuration
  private readonly AUTO_BLOCK_THRESHOLD = 5; // violations before auto-block
  private readonly AUTO_BLOCK_DURATION = 60 * 60 * 1000; // 1 hour in ms

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if IP is currently blocked
   */
  isIPBlocked(ip: string): boolean {
    const unblockTime = this.blockedIPs.get(ip);
    if (!unblockTime) return false;

    if (Date.now() > unblockTime) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Check rate limit with security logging
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const { limit, windowMs, endpoint, skipLogging } = config;
    const now = Date.now();

    // Extract IP from key (format: "ip:xxx" or just IP)
    const ip = key.startsWith("ip:") ? key.substring(3) : key;

    // Check if IP is blocked
    if (this.isIPBlocked(ip)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: this.blockedIPs.get(ip) || now + this.AUTO_BLOCK_DURATION,
        isBlocked: true,
      };
    }

    const entry = this.cache.get(key);

    // No entry or expired window - create new entry
    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs;
      this.cache.set(key, {
        count: 1,
        resetTime,
        violations: entry?.violations || 0,
      });
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime,
      };
    }

    // Increment count
    entry.count++;
    this.cache.set(key, entry);

    // Check if over limit
    if (entry.count > limit) {
      entry.violations++;
      this.cache.set(key, entry);

      // Log security event (async, non-blocking)
      if (!skipLogging) {
        this.logViolation(ip, endpoint || "unknown", entry.count, limit).catch(
          (err) => console.error("[RATE LIMITER] Logging failed:", err)
        );
      }

      // Auto-block if threshold exceeded
      if (entry.violations >= this.AUTO_BLOCK_THRESHOLD) {
        const unblockTime = now + this.AUTO_BLOCK_DURATION;
        this.blockedIPs.set(ip, unblockTime);

        // Log auto-block event
        if (!skipLogging) {
          this.logAutoBlock(ip, entry.violations).catch((err) =>
            console.error("[RATE LIMITER] Auto-block logging failed:", err)
          );
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime: unblockTime,
          isBlocked: true,
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Log rate limit violation to security_events
   */
  private async logViolation(
    ip: string,
    endpoint: string,
    requestCount: number,
    limit: number
  ): Promise<void> {
    try {
      await logSecurityEvent({
        eventType: "rate_limit_exceeded",
        severity: requestCount > limit * 2 ? "high" : "medium",
        ipAddress: ip,
        endpoint,
        method: "RATE_LIMIT",
        requestCount,
        details: {
          limit,
          actual_requests: requestCount,
          exceeded_by: requestCount - limit,
        },
      });
    } catch (error) {
      console.error("[RATE LIMITER] Failed to log violation:", error);
    }
  }

  /**
   * Log auto-block event to security_events
   */
  private async logAutoBlock(ip: string, violations: number): Promise<void> {
    try {
      await logSecurityEvent({
        eventType: "brute_force_detected",
        severity: "critical",
        ipAddress: ip,
        endpoint: "AUTO_BLOCK",
        method: "SYSTEM",
        requestCount: violations,
        details: {
          reason: "Automatic IP block after repeated rate limit violations",
          violations,
          threshold: this.AUTO_BLOCK_THRESHOLD,
          block_duration_minutes: this.AUTO_BLOCK_DURATION / 60000,
        },
        autoBlock: true,
        blockDurationMinutes: this.AUTO_BLOCK_DURATION / 60000,
      });
    } catch (error) {
      console.error("[RATE LIMITER] Failed to log auto-block:", error);
    }
  }

  /**
   * Manually block an IP
   */
  blockIP(ip: string, durationMs: number = this.AUTO_BLOCK_DURATION): void {
    const unblockTime = Date.now() + durationMs;
    this.blockedIPs.set(ip, unblockTime);
  }

  /**
   * Manually unblock an IP
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    // Also reset rate limit entry
    this.reset(`ip:${ip}`);
  }

  /**
   * Remove a rate limit entry (useful for manual resets)
   */
  reset(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const toDeleteCache: string[] = [];
    const toDeleteBlocked: string[] = [];

    // Clean up rate limit cache
    this.cache.forEach((entry, key) => {
      if (now > entry.resetTime) {
        toDeleteCache.push(key);
      }
    });

    // Clean up blocked IPs
    this.blockedIPs.forEach((unblockTime, ip) => {
      if (now > unblockTime) {
        toDeleteBlocked.push(ip);
      }
    });

    toDeleteCache.forEach((key) => this.cache.delete(key));
    toDeleteBlocked.forEach((ip) => this.blockedIPs.delete(ip));

    if (toDeleteCache.length > 0 || toDeleteBlocked.length > 0) {
      console.log(
        `[RATE LIMITER] Cleaned up ${toDeleteCache.length} cache entries, ${toDeleteBlocked.length} blocked IPs`
      );
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    cacheSize: number;
    blockedIPsCount: number;
    totalViolations: number;
  } {
    let totalViolations = 0;
    this.cache.forEach((entry) => {
      totalViolations += entry.violations;
    });

    return {
      cacheSize: this.cache.size,
      blockedIPsCount: this.blockedIPs.size,
      totalViolations,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Export singleton instance
export const enhancedRateLimiter = new EnhancedRateLimiter();

// Export helper function for easy integration
export async function checkRateLimit(
  request: Request,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  // Check if this is an admin user - exempt from rate limiting
  // Admin routes are already protected by auth middleware
  const url = new URL(request.url);
  const isAdminRoute = url.pathname.startsWith("/api/admin/");

  if (isAdminRoute) {
    // TODO: Properly check admin role from session
    // For now, exempt all admin routes since they're already auth-protected
    // This prevents admins from being locked out when viewing security events
    console.log(
      "[RATE LIMITER] Exempting admin route from rate limiting:",
      url.pathname
    );
    return {
      allowed: true,
      remaining: 999,
      resetTime: Date.now() + (config.windowMs || 60 * 60 * 1000),
    };
  }

  // Get IP from headers
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  // Extract endpoint from URL
  const endpoint = config.endpoint || url.pathname;

  // Use default limits if not specified
  const finalConfig: RateLimitConfig = {
    limit: config.limit || 100,
    windowMs: config.windowMs || 60 * 60 * 1000, // 1 hour default
    endpoint,
    skipLogging: config.skipLogging || false,
  };

  return await enhancedRateLimiter.check(`ip:${ip}`, finalConfig);
}
