"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSecurityAlerts } from "@/hooks/useSecurityAlerts";
import { cn } from "@/lib/utils";

const MAX_BADGE = 99;

function formatUnreadCount(count: number): string {
  if (count > MAX_BADGE) {
    return `${MAX_BADGE}+`;
  }
  return String(count);
}

interface SecurityAlertsBadgeProps {
  className?: string;
}

export function SecurityAlertsBadge({
  className,
}: SecurityAlertsBadgeProps = {}) {
  const {
    alerts,
    unreadCount,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead,
    clearAlerts,
  } = useSecurityAlerts({
    enableNotifications: true,
    severityLevels: ["critical", "high"],
    maxAlerts: 50,
    autoDismissMs: 300000, // 5 minutes
  });

  const [isOpen, setIsOpen] = React.useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "high":
        return "text-orange-600 dark:text-orange-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 border-red-500/20 hover:bg-red-500/15";
      case "high":
        return "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15";
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/15";
      default:
        return "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15";
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 dark:border-border/50",
            className
          )}
          aria-label="Security alerts"
        >
          <Shield className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />

          {/* Connection status indicator */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: isConnected ? 1 : 0 }}
            className="absolute bottom-1 right-1 h-2 w-2 bg-green-500 rounded-full"
          />

          {/* Unread count badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                layoutId="security-alert-count"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-lg"
              >
                {formatUnreadCount(unreadCount)}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Pulse animation for critical alerts */}
          {alerts.some((a) => a.severity === "critical") && (
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-red-500"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          )}
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={16}
        className="w-[400px] overflow-hidden rounded-3xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Security Alerts</h3>
            {isConnected && (
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs"
              >
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                Live
              </Badge>
            )}
            {connectionError && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs"
              >
                Connecting...
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-8 px-2"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  <span className="text-xs">Read all</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAlerts}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto mt-3">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No security alerts</p>
              <p className="text-xs mt-1">
                {isConnected ? "Monitoring in real-time" : "Connecting..."}
              </p>
              {connectionError && (
                <p className="text-xs mt-2 text-amber-600 dark:text-amber-400">
                  {connectionError}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-3 rounded-xl border transition-all duration-200 cursor-pointer",
                    getSeverityBg(alert.severity)
                  )}
                  onClick={() => markAsRead(alert.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            getSeverityColor(alert.severity)
                          )}
                        >
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(alert.created_at)}
                        </span>
                      </div>

                      <p className="text-sm font-medium line-clamp-1">
                        {alert.event_type.replace(/_/g, " ").toUpperCase()}
                      </p>

                      {alert.user_email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.user_email}
                        </p>
                      )}

                      {alert.ip_address && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {alert.ip_address}
                          {alert.city && ` (${alert.city})`}
                        </p>
                      )}
                    </div>

                    {alert.severity === "critical" && (
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="flex-shrink-0"
                      >
                        🚨
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-border/30 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => {
              setIsOpen(false);
              window.location.href = "/admin/security/events";
            }}
          >
            View All Events
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
