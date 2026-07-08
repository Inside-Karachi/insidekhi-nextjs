/**
 * Security Event Logging Utilities
 *
 * Provides functions to log security events, track threats,
 * and automatically block malicious IPs.
 */

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  SecurityEventType,
  SecuritySeverity,
  CreateSecurityEventData,
} from "@/types/security.types";

// =====================================================
// SECURITY EVENT LOGGING
// =====================================================

/**
 * Log a security event to the database
 */
export async function logSecurityEvent(
  data: CreateSecurityEventData
): Promise<void> {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    const { error } = await supabase.from("security_events").insert({
      event_type: data.eventType,
      severity: data.severity,
      user_id: data.userId || null,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      endpoint: data.endpoint || null,
      method: data.method || null,
      request_count: data.requestCount || 1,
      details: data.details || {},
      auto_blocked: data.autoBlock || false,
      block_duration_minutes: data.blockDurationMinutes || null,
    });

    if (error) {
      console.error("[SECURITY] Failed to log event:", error);
      return;
    }

    // Auto-block if needed
    if (data.autoBlock && data.ipAddress) {
      await autoBlockIP(
        data.ipAddress,
        data.eventType,
        data.severity,
        data.blockDurationMinutes
      );
    }

    // Check for alert thresholds
    await checkSecurityThresholds(data);
  } catch (error) {
    console.error("[SECURITY] Error logging security event:", error);
  }
}

// =====================================================
// AUTO-BLOCKING
// =====================================================

/**
 * Automatically block an IP address based on security event
 */
async function autoBlockIP(
  ipAddress: string,
  reason: SecurityEventType,
  severity: SecuritySeverity,
  durationMinutes?: number
): Promise<void> {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    // Check if auto-blocking is enabled
    const { data: config } = await supabase
      .from("system_config")
      .select("config_value")
      .eq("config_key", "security.auto_block_enabled")
      .single();

    if (!config || config.config_value !== true) {
      console.log("[SECURITY] Auto-blocking is disabled, skipping IP block");
      return;
    }

    // Get default block duration if not provided
    if (!durationMinutes) {
      const { data: durationConfig } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("config_key", "security.block_duration_minutes")
        .single();

      durationMinutes = (durationConfig?.config_value as number) || 60;
    }

    // Block the IP using RPC function
    const { error } = await supabase.rpc("block_ip", {
      p_ip_address: ipAddress,
      p_reason: `Auto-blocked: ${reason}`,
      p_severity: severity,
      p_duration_minutes: durationMinutes ?? undefined,
    });

    if (error) {
      console.error("[SECURITY] Failed to auto-block IP:", error);
      return;
    }

    console.log(
      `[SECURITY] Auto-blocked IP ${ipAddress} for ${durationMinutes} minutes (reason: ${reason})`
    );
  } catch (error) {
    console.error("[SECURITY] Error in auto-block:", error);
  }
}

// =====================================================
// THRESHOLD CHECKING
// =====================================================

/**
 * Check if security thresholds are exceeded and trigger alerts
 */
async function checkSecurityThresholds(
  data: CreateSecurityEventData
): Promise<void> {
  try {
    // For critical events, log immediately
    if (data.severity === "critical") {
      console.error(
        `[SECURITY ALERT] CRITICAL event: ${data.eventType}`,
        data.details
      );

      // TODO: Send notification to super admins
      // This will be implemented when we integrate with notification system
    }

    // For high severity, check if we should escalate
    if (data.severity === "high" && data.ipAddress) {
      const supabase = await createServerSupabase({ useServiceRole: true });

      // Count recent high/critical events from this IP
      const { data: recentEvents, error } = await supabase
        .from("security_events")
        .select("id")
        .eq("ip_address", data.ipAddress)
        .in("severity", ["high", "critical"])
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[SECURITY] Failed to check event threshold:", error);
        return;
      }

      const eventCount = (recentEvents?.length || 0) + 1;

      // If more than 3 high/critical events in an hour, escalate
      if (eventCount >= 3) {
        console.warn(
          `[SECURITY ALERT] IP ${data.ipAddress} has ${eventCount} high/critical events in the last hour`
        );

        // Auto-block if not already blocked
        if (!data.autoBlock) {
          await autoBlockIP(data.ipAddress, data.eventType, "critical", 120);
        }
      }
    }
  } catch (error) {
    console.error("[SECURITY] Error checking thresholds:", error);
  }
}

// =====================================================
// SPECIALIZED LOGGING FUNCTIONS
// =====================================================

/**
 * Log a failed login attempt and check for brute force
 */
export async function logFailedLogin(
  email: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const supabase = await createServerSupabase({ useServiceRole: true });

  // Get brute force threshold
  const { data: thresholdConfig } = await supabase
    .from("system_config")
    .select("config_value")
    .eq("config_key", "security.brute_force_threshold")
    .single();

  const bruteForceThreshold = (thresholdConfig?.config_value as number) || 10;

  // Check for recent failures from this IP
  const { data: recentFailures } = await supabase
    .from("security_events")
    .select("id")
    .eq("event_type", "failed_login")
    .eq("ip_address", ipAddress)
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Last 15 minutes
    .order("created_at", { ascending: false });

  const failureCount = (recentFailures?.length || 0) + 1;
  const isBruteForce = failureCount >= bruteForceThreshold;

  await logSecurityEvent({
    eventType: isBruteForce ? "brute_force_detected" : "failed_login",
    severity: isBruteForce ? "critical" : "medium",
    ipAddress,
    userAgent,
    endpoint: "/api/auth/login",
    method: "POST",
    requestCount: failureCount,
    details: { email, failureCount },
    autoBlock: isBruteForce,
    blockDurationMinutes: isBruteForce ? 120 : undefined,
  });
}

/**
 * Log a successful login
 */
export async function logSuccessfulLogin(
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  await logSecurityEvent({
    eventType: "successful_login",
    severity: "low",
    userId,
    ipAddress,
    userAgent,
    endpoint: "/api/auth/login",
    method: "POST",
    details: { action: "login" },
  });
}

/**
 * Log a rate limit violation
 */
export async function logRateLimitViolation(
  endpoint: string,
  ipAddress: string,
  userId: string | undefined,
  requestCount: number,
  limitThreshold: number
): Promise<void> {
  const severity: SecuritySeverity =
    requestCount > limitThreshold * 2 ? "high" : "medium";

  await logSecurityEvent({
    eventType: "rate_limit_exceeded",
    severity,
    userId,
    ipAddress,
    endpoint,
    requestCount,
    details: {
      limit: limitThreshold,
      exceeded_by: requestCount - limitThreshold,
    },
    autoBlock: requestCount > limitThreshold * 3, // Auto-block if 3x over limit
    blockDurationMinutes: 30,
  });
}

/**
 * Log unauthorized admin access attempt
 */
export async function logUnauthorizedAdminAccess(
  userId: string | undefined,
  ipAddress: string,
  endpoint: string,
  userAgent: string
): Promise<void> {
  await logSecurityEvent({
    eventType: "admin_access_denied",
    severity: "high",
    userId,
    ipAddress,
    userAgent,
    endpoint,
    method: "GET",
    details: { attempted_resource: endpoint },
  });
}

/**
 * Log bulk operation attempt
 */
export async function logBulkOperation(
  userId: string,
  operationType: string,
  recordCount: number,
  entityType: string
): Promise<void> {
  const severity: SecuritySeverity = recordCount > 100 ? "high" : "medium";

  await logSecurityEvent({
    eventType: "bulk_operation_attempted",
    severity,
    userId,
    details: {
      operation: operationType,
      record_count: recordCount,
      entity_type: entityType,
    },
  });
}

/**
 * Log data export request
 */
export async function logDataExport(
  userId: string,
  exportType: string,
  recordCount: number
): Promise<void> {
  await logSecurityEvent({
    eventType: "export_requested",
    severity: recordCount > 1000 ? "high" : "medium",
    userId,
    details: {
      export_type: exportType,
      record_count: recordCount,
    },
  });
}

/**
 * Log system configuration change
 */
export async function logConfigChange(
  userId: string,
  configKey: string,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  await logSecurityEvent({
    eventType: "config_changed",
    severity: "medium",
    userId,
    details: {
      config_key: configKey,
      old_value: oldValue as string | number | boolean | null,
      new_value: newValue as string | number | boolean | null,
    },
  });
}

// =====================================================
// IP CHECKING
// =====================================================

/**
 * Check if an IP is currently blocked
 */
export async function isIPBlocked(ipAddress: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    const { data, error } = await supabase.rpc("is_ip_blocked", {
      check_ip: ipAddress,
    });

    if (error) {
      console.error("[SECURITY] Error checking IP block status:", error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error("[SECURITY] Error in isIPBlocked:", error);
    return false;
  }
}

/**
 * Manually block an IP address
 */
export async function blockIP(
  ipAddress: string,
  reason: string,
  severity: SecuritySeverity,
  durationMinutes?: number,
  blockedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    const { error } = await supabase.rpc("block_ip", {
      p_ip_address: ipAddress,
      p_reason: reason,
      p_severity: severity,
      p_duration_minutes: durationMinutes ?? undefined,
      p_blocked_by: blockedBy ?? undefined,
    });

    if (error) {
      console.error("[SECURITY] Failed to block IP:", error);
      return { success: false, error: error.message };
    }

    // Log the manual block as a security event
    await logSecurityEvent({
      eventType: "suspicious_ip",
      severity,
      ipAddress,
      details: {
        action: "manual_block",
        reason,
        duration_minutes: durationMinutes,
        blocked_by: blockedBy,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[SECURITY] Error blocking IP:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Unblock an IP address
 */
export async function unblockIP(
  ipAddress: string,
  unblockedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    const { error } = await supabase.rpc("unblock_ip", {
      p_ip_address: ipAddress,
      p_unblocked_by: unblockedBy ?? undefined,
    });

    if (error) {
      console.error("[SECURITY] Failed to unblock IP:", error);
      return { success: false, error: error.message };
    }

    // Log the manual unblock
    await logSecurityEvent({
      eventType: "suspicious_ip",
      severity: "low",
      ipAddress,
      details: {
        action: "manual_unblock",
        unblocked_by: unblockedBy,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[SECURITY] Error unblocking IP:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Extract IP address from request headers
 */
export function getClientIP(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  return "unknown";
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(headers: Headers): string {
  return headers.get("user-agent") || "unknown";
}

/**
 * Sanitize IP address for logging
 */
export function sanitizeIP(ip: string): string | null {
  if (!ip || ip === "unknown") {
    return null;
  }

  // Basic validation for IPv4 and IPv6
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
    return ip;
  }

  return null;
}
