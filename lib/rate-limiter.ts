/**
 * Simple in-memory rate limiter for API endpoints
 * Production note: For distributed systems, use Redis or similar
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private cache: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is allowed under rate limit
   * @param key - Unique identifier for the rate limit (e.g., "user:123", "ip:192.168.1.1")
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns Object with allowed status and remaining requests
   */
  check(
    key: string,
    limit: number,
    windowMs: number
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.cache.get(key);

    // No entry or expired window - create new entry
    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs;
      this.cache.set(key, {
        count: 1,
        resetTime,
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
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.resetTime) {
        toDelete.push(key);
      }
    });

    toDelete.forEach((key) => this.cache.delete(key));

    if (toDelete.length > 0) {
      console.log(
        `[RATE LIMITER] Cleaned up ${toDelete.length} expired entries`
      );
    }
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): {
    totalEntries: number;
    activeUsers: number;
  } {
    const now = Date.now();
    let activeUsers = 0;

    this.cache.forEach((entry) => {
      if (now <= entry.resetTime) {
        activeUsers++;
      }
    });

    return {
      totalEntries: this.cache.size,
      activeUsers,
    };
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Stop the cleanup interval (important for graceful shutdown)
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Cleanup on process exit
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => rateLimiter.destroy());
  process.on("SIGINT", () => rateLimiter.destroy());
}

export default rateLimiter;

// Named exports for specific use cases
export const userCreationLimiter = {
  /**
   * Check rate limit for user creation by admin
   * @param adminId - ID of the admin creating users
   * @returns Rate limit check result
   */
  check: (adminId: string) => {
    // 10 users per minute per admin
    return rateLimiter.check(`user-creation:${adminId}`, 10, 60000);
  },
  reset: (adminId: string) => {
    rateLimiter.reset(`user-creation:${adminId}`);
  },
};

export const loginLimiter = {
  /**
   * Check rate limit for login attempts by IP
   * @param ip - IP address of the requester
   * @returns Rate limit check result
   */
  check: (ip: string) => {
    // 5 login attempts per 15 minutes per IP
    return rateLimiter.check(`login:${ip}`, 5, 15 * 60000);
  },
  reset: (ip: string) => {
    rateLimiter.reset(`login:${ip}`);
  },
};

export const loginFailureLimiter = {
  /**
   * Track failed login attempts by IP for escalation logic
   * 3 failed attempts per 15 minutes per IP before additional checks are required
   */
  check: (ip: string) => {
    return rateLimiter.check(`login-fail:${ip}`, 3, 15 * 60000);
  },
  reset: (ip: string) => {
    rateLimiter.reset(`login-fail:${ip}`);
  },
};

export const signupLimiter = {
  /**
   * Limit signup attempts per IP to mitigate spam signups
   * 5 signups per hour per IP
   */
  check: (ip: string) => {
    return rateLimiter.check(`signup:${ip}`, 5, 60 * 60000);
  },
  reset: (ip: string) => {
    rateLimiter.reset(`signup:${ip}`);
  },
};

export const passwordResetLimiter = {
  /**
   * Check rate limit for password resets by admin
   * @param adminId - ID of the admin resetting passwords
   * @returns Rate limit check result
   */
  check: (adminId: string) => {
    // 20 password resets per minute per admin
    return rateLimiter.check(`password-reset:${adminId}`, 20, 60000);
  },
  reset: (adminId: string) => {
    rateLimiter.reset(`password-reset:${adminId}`);
  },
};
