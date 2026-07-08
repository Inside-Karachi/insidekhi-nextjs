/**
 * Real-time Security Alerts Hook
 * Subscribes to critical security events via Supabase Realtime
 * Provides browser notifications for super admins
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface SecurityAlert {
  id: number;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  user_email?: string;
  ip_address?: string;
  country_code?: string;
  city?: string;
  endpoint?: string;
  method?: string;
  status_code?: number;
  request_count?: number;
  resolved: boolean;
  created_at: string;
}

interface UseSecurityAlertsOptions {
  /**
   * Enable browser notifications
   * @default true
   */
  enableNotifications?: boolean;

  /**
   * Filter by severity levels
   * @default ["critical", "high"]
   */
  severityLevels?: Array<"low" | "medium" | "high" | "critical">;

  /**
   * Maximum alerts to keep in memory
   * @default 50
   */
  maxAlerts?: number;

  /**
   * Auto-dismiss alerts after (ms)
   * @default 30000 (30 seconds)
   */
  autoDismissMs?: number;
}

interface UseSecurityAlertsReturn {
  alerts: SecurityAlert[];
  unreadCount: number;
  isConnected: boolean;
  connectionError?: string;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  clearAlerts: () => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
}

/**
 * Hook to subscribe to real-time security alerts
 */
export function useSecurityAlerts(
  options: UseSecurityAlertsOptions = {}
): UseSecurityAlertsReturn {
  const {
    enableNotifications = true,
    severityLevels = ["critical", "high"],
    maxAlerts = 50,
    autoDismissMs = 30000,
  } = options;

  const [alerts, setAlerts] = React.useState<SecurityAlert[]>([]);
  const [readAlertIds, setReadAlertIds] = React.useState<Set<number>>(
    new Set()
  );
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string>();
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  // Request notification permission
  const requestNotificationPermission =
    React.useCallback(async (): Promise<NotificationPermission> => {
      if (!("Notification" in window)) {
        console.warn("[SECURITY ALERTS] Notifications not supported");
        return "denied";
      }

      if (Notification.permission === "granted") {
        return "granted";
      }

      if (Notification.permission === "denied") {
        return "denied";
      }

      try {
        const permission = await Notification.requestPermission();
        return permission;
      } catch (error) {
        console.error("[SECURITY ALERTS] Permission error:", error);
        return "denied";
      }
    }, []);

  // Show browser notification
  const showNotification = React.useCallback(
    (alert: SecurityAlert) => {
      if (!enableNotifications || Notification.permission !== "granted") {
        return;
      }

      const title =
        alert.severity === "critical"
          ? "🚨 Critical Security Alert"
          : "⚠️ Security Alert";

      const body = `${alert.event_type.replace(/_/g, " ").toUpperCase()}\n${
        alert.user_email || alert.ip_address || "Unknown source"
      }`;

      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `security-alert-${alert.id}`,
        requireInteraction: alert.severity === "critical",
        silent: false,
      });

      // Auto-close notification
      setTimeout(() => {
        notification.close();
      }, 10000);

      // Click handler to focus window
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    },
    [enableNotifications]
  );

  // Mark alert as read
  const markAsRead = React.useCallback((id: number) => {
    setReadAlertIds((prev) => new Set([...prev, id]));
  }, []);

  // Mark all as read
  const markAllAsRead = React.useCallback(() => {
    setReadAlertIds((prev) => {
      const newSet = new Set(prev);
      alerts.forEach((alert) => newSet.add(alert.id));
      return newSet;
    });
  }, [alerts]);

  // Clear all alerts
  const clearAlerts = React.useCallback(() => {
    setAlerts([]);
    setReadAlertIds(new Set());
  }, []);

  // Auto-dismiss old alerts
  React.useEffect(() => {
    if (autoDismissMs <= 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setAlerts((prev) =>
        prev.filter((alert) => {
          const alertTime = new Date(alert.created_at).getTime();
          return now - alertTime < autoDismissMs;
        })
      );
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [autoDismissMs]);

  // Set up Realtime subscription
  React.useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 1000; // 1 second

    // Request notification permission on mount
    if (enableNotifications && Notification.permission === "default") {
      requestNotificationPermission();
    }

    const setupSubscription = (delay = 0) => {
      if (delay > 0) {
        const timeout = setTimeout(() => {
          if (mounted) {
            setupSubscription(0);
          }
        }, delay);
        return () => clearTimeout(timeout);
      }

      // Subscribe to security_events table
      // NOTE: security_events table must have Realtime enabled in Supabase
      const channel = supabase
        .channel(`security-alerts-${Date.now()}`, {
          config: {
            broadcast: { self: false },
            presence: { key: "" },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "security_events",
          },
          (payload) => {
            if (!mounted) return;

            const newAlert = payload.new as SecurityAlert;

            // Filter by severity locally
            if (!severityLevels.includes(newAlert.severity)) {
              return;
            }

            // Add to alerts list
            setAlerts((prev) => {
              const updated = [newAlert, ...prev];
              // Keep only maxAlerts most recent
              return updated.slice(0, maxAlerts);
            });

            // Show browser notification
            showNotification(newAlert);
          }
        )
        .subscribe((status) => {
          if (!mounted) return;

          if (status === "SUBSCRIBED") {
            setIsConnected(true);
            setConnectionError(undefined);
            retryCount = 0; // Reset retry count on successful connection
          } else if (status === "CHANNEL_ERROR") {
            setIsConnected(false);

            // Retry with exponential backoff if we haven't exceeded max retries
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
              console.warn(
                `[SECURITY ALERTS] Connection failed. Retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})...`
              );
              setConnectionError(
                `Realtime connection failed. Retrying... (${retryCount}/${MAX_RETRIES})`
              );
              supabase.removeChannel(channel).catch(() => {
                // Ignore cleanup errors
              });
              setupSubscription(delay);
            } else {
              const errorMsg =
                "Realtime connection failed after retries. Check RLS policies on security_events table.";
              setConnectionError(errorMsg);
              console.error("[SECURITY ALERTS]", errorMsg);
            }
          } else if (status === "CLOSED") {
            setIsConnected(false);
          }
        });

      channelRef.current = channel;
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch((err) => {
          console.warn("[SECURITY ALERTS] Cleanup warning:", err);
        });
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate unread count
  const unreadCount = React.useMemo(() => {
    return alerts.filter((alert) => !readAlertIds.has(alert.id)).length;
  }, [alerts, readAlertIds]);

  return {
    alerts,
    unreadCount,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    requestNotificationPermission,
  };
}
