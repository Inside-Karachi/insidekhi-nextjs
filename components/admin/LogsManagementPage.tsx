"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Search,
  FileText,
  Database,
  Activity,
  RefreshCw,
  Shield,
  Upload,
  Bell,
} from "lucide-react";
import { format } from "date-fns";

// Client-side time formatter to prevent hydration mismatch
function ClientTimeFormatter({ date }: { date: string }) {
  const [formattedTime, setFormattedTime] = useState("");

  useEffect(() => {
    // Format time on client side only
    setFormattedTime(format(new Date(date), "HH:mm:ss"));
  }, [date]);

  return <span>{formattedTime}</span>;
}

// Client-side last refresh formatter
function ClientLastRefreshFormatter({ date }: { date: Date | null }) {
  const [formattedTime, setFormattedTime] = useState("");

  useEffect(() => {
    if (date) {
      setFormattedTime(date.toLocaleTimeString());
    } else {
      setFormattedTime("Never");
    }
  }, [date]);

  return <span>{formattedTime}</span>;
}

interface LogEntry {
  id: string;
  log_type: "points" | "import" | "audit" | "upload";
  created_at: string;
  points?: number;
  reason?: string;
  related_id?: string;
  user_id?: string;
  profiles?: {
    full_name: string;
    username: string;
    avatar_url?: string;
  };
  import_id?: string;
  table_name?: string;
  record_id?: string;
  rollback_action?: string;
  import_history?: {
    filename: string;
    status: string;
    total_records: number;
    successful_imports: number;
    failed_imports: number;
    import_type: string;
    profiles?: {
      full_name: string;
      username: string;
    };
  };
  // Audit log fields
  admin_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  // Upload audit fields
  submission_id?: number;
  event?: string;
  status?: string;
  details?: Record<string, unknown>;
  ip?: string;
  // Admin profile for audit logs
  admin_profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  user_profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface LogsResponse {
  logs: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalPoints: number;
    totalImports: number;
    totalAudit: number;
    totalUploads: number;
    totalLogs: number;
  };
}

export default function LogsManagementPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<
    LogsResponse["pagination"] | null
  >(null);
  const [summary, setSummary] = useState<LogsResponse["summary"] | null>(null);

  // Filters
  const [logType, setLogType] = useState("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [entityType, setEntityType] = useState("all"); // listing, event, user, etc.
  const [entityId, setEntityId] = useState(""); // Specific entity ID
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [newLogsCount, setNewLogsCount] = useState(0);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: logType,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.append("search", search);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (entityType && entityType !== "all")
        params.append("entityType", entityType);
      if (entityId) params.append("entityId", entityId);

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data: LogsResponse = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
      setSummary(data.summary);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [logType, page, search, startDate, endDate, entityType, entityId, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // WebSocket real-time updates for audit logs
  // NOTE: Realtime updates only show when no date/entity filters are active
  useEffect(() => {
    // Check if any filters would exclude new logs
    const hasActiveFilters = !!(
      startDate ||
      endDate ||
      (entityType && entityType !== "all") ||
      entityId
    );

    const supabaseClient = createClient();

    // Subscribe to audit_logs table changes
    const auditLogsChannel = supabaseClient
      .channel("audit_logs_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          console.log("New audit log received:", payload.new);
          // Only add to UI if no filters are active that would exclude it
          if (!hasActiveFilters) {
            setLogs((prevLogs) => [payload.new as LogEntry, ...prevLogs]);
            setSummary((prev) =>
              prev
                ? {
                    ...prev,
                    totalAudit: prev.totalAudit + 1,
                    totalLogs: prev.totalLogs + 1,
                  }
                : null,
            );
          }
          // Always increment counter to show new data is available
          setNewLogsCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "points_log",
        },
        (payload) => {
          console.log("New points log received:", payload.new);
          if (!hasActiveFilters) {
            setLogs((prevLogs) => [payload.new as LogEntry, ...prevLogs]);
            setSummary((prev) =>
              prev
                ? {
                    ...prev,
                    totalPoints: prev.totalPoints + 1,
                    totalLogs: prev.totalLogs + 1,
                  }
                : null,
            );
          }
          setNewLogsCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "import_rollback_log",
        },
        (payload) => {
          console.log("New import log received:", payload.new);
          if (!hasActiveFilters) {
            setLogs((prevLogs) => [payload.new as LogEntry, ...prevLogs]);
            setSummary((prev) =>
              prev
                ? {
                    ...prev,
                    totalImports: prev.totalImports + 1,
                    totalLogs: prev.totalLogs + 1,
                  }
                : null,
            );
          }
          setNewLogsCount((prev) => prev + 1);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeConnected(true);
          console.log("Real-time connection established");
        } else if (status === "CLOSED") {
          setIsRealtimeConnected(false);
          console.log("Real-time connection closed");
        }
      });

    return () => {
      supabaseClient.removeChannel(auditLogsChannel);
    };
  }, [startDate, endDate, entityType, entityId]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setNewLogsCount(0); // Reset new logs counter
    await fetchLogs();
  };

  const handleExport = () => {
    // Export functionality would be implemented here
    console.log("Export logs functionality");
  };

  const getLogTypeBadge = (type: string) => {
    const baseClasses =
      "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border backdrop-blur-sm transition-all duration-200";

    switch (type) {
      case "points":
        return (
          <Badge
            className={`${baseClasses} bg-gradient-to-r from-blue-500/15 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 dark:border-blue-500/40 hover:from-blue-500/20 hover:to-blue-500/15`}
          >
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            Points
          </Badge>
        );
      case "import":
        return (
          <Badge
            className={`${baseClasses} bg-gradient-to-r from-green-500/15 to-green-500/10 dark:from-green-500/20 dark:to-green-500/15 text-green-700 dark:text-green-300 border-green-500/30 dark:border-green-500/40 hover:from-green-500/20 hover:to-green-500/15`}
          >
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            Import
          </Badge>
        );
      case "audit":
        return (
          <Badge
            className={`${baseClasses} bg-gradient-to-r from-red-500/15 to-red-500/10 dark:from-red-500/20 dark:to-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 dark:border-red-500/40 hover:from-red-500/20 hover:to-red-500/15`}
          >
            <Shield className="w-3 h-3" />
            Audit
          </Badge>
        );
      case "upload":
        return (
          <Badge
            className={`${baseClasses} bg-gradient-to-r from-purple-500/15 to-purple-500/10 dark:from-purple-500/20 dark:to-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 dark:border-purple-500/40 hover:from-purple-500/20 hover:to-purple-500/15`}
          >
            <Upload className="w-3 h-3" />
            Upload
          </Badge>
        );
      default:
        return (
          <Badge
            className={`${baseClasses} bg-gradient-to-r from-gray-500/15 to-gray-500/10 dark:from-gray-500/20 dark:to-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30 dark:border-gray-500/40 hover:from-gray-500/20 hover:to-gray-500/15`}
          >
            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
            {type}
          </Badge>
        );
    }
  };

  const getUserDisplayName = (log: LogEntry) => {
    if (log.log_type === "points") {
      return (
        log.profiles?.full_name || log.profiles?.username || "Unknown User"
      );
    } else if (log.log_type === "import") {
      return (
        log.import_history?.profiles?.full_name ||
        log.import_history?.profiles?.username ||
        "Unknown User"
      );
    } else if (log.log_type === "audit") {
      // For audit logs, show the admin who performed the action
      const adminProfile = (
        log as LogEntry & {
          admin_profile?: {
            full_name: string | null;
            username: string | null;
            avatar_url: string | null;
          } | null;
        }
      ).admin_profile;
      if (adminProfile) {
        return (
          adminProfile.full_name || adminProfile.username || "Unknown Admin"
        );
      }
      return "System";
    }
    return "Unknown User";
  };

  const getDeviceType = (userAgent?: string) => {
    if (!userAgent) return "Unknown";

    const ua = userAgent.toLowerCase();
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      return "Mobile";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
      return "Tablet";
    } else {
      return "Desktop";
    }
  };

  const getLocationFromIP = (ipAddress?: string) => {
    if (!ipAddress || ipAddress === "unknown" || ipAddress === "server") {
      return "Unknown";
    }

    // No GeoIP lookup; show the IP as-is.
    return ipAddress;
  };

  const getIPAddress = (log: LogEntry) => {
    // Check different possible IP fields based on log type
    if (log.log_type === "audit" && log.ip_address) {
      return log.ip_address;
    } else if (log.log_type === "upload" && log.ip) {
      return log.ip;
    }
    return "N/A";
  };

  const getUserAgent = (log: LogEntry) => {
    // Check different possible user agent fields based on log type
    if (log.log_type === "audit" && log.user_agent) {
      return log.user_agent;
    }
    return undefined;
  };

  const formatLogDetails = (log: LogEntry) => {
    if (log.log_type === "points") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                log.points && log.points > 0
                  ? "bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30"
                  : "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30"
              }`}
            >
              {log.points && log.points > 0 ? "+" : ""}
              {log.points} points
            </div>
            <span className="text-xs font-medium text-foreground/90">
              {log.reason}
            </span>
          </div>
          {log.related_id && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded text-xs text-muted-foreground border border-border/30">
              <span className="font-medium">ID:</span>
              <code className="font-mono text-xs">{log.related_id}</code>
            </div>
          )}
        </div>
      );
    } else if (log.log_type === "import") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded text-xs font-bold border border-blue-500/30">
              {log.rollback_action}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Table:</span>
            <code className="font-mono bg-muted/50 px-1 py-0.5 rounded border border-border/30 text-xs">
              {log.table_name}
            </code>
            <span className="font-medium">Record:</span>
            <code className="font-mono bg-muted/50 px-1 py-0.5 rounded border border-border/30 text-xs">
              {log.record_id}
            </code>
          </div>
          {log.import_history && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">Import:</span>
              <span
                className="truncate max-w-32"
                title={log.import_history.filename}
              >
                {log.import_history.filename}
              </span>
              <Badge
                variant="outline"
                className={`text-xs px-1.5 py-0.5 ${
                  log.import_history.status === "completed"
                    ? "border-green-500/50 text-green-600 dark:text-green-400"
                    : "border-yellow-500/50 text-yellow-600 dark:text-yellow-400"
                }`}
              >
                {log.import_history.status}
              </Badge>
            </div>
          )}
        </div>
      );
    } else if (log.log_type === "audit") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 bg-red-500/15 text-red-700 dark:text-red-300 rounded text-xs font-bold border border-red-500/30">
              {log.action?.replace(/_/g, " ").toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Entity:</span>
            <code className="font-mono bg-muted/50 px-1 py-0.5 rounded border border-border/30 text-xs">
              {log.entity_type}
            </code>
            {log.entity_id && (
              <>
                <span className="font-medium">ID:</span>
                <code className="font-mono bg-muted/50 px-1 py-0.5 rounded border border-border/30 text-xs">
                  {log.entity_id}
                </code>
              </>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="text-xs text-muted-foreground italic">
        Unknown log type
      </div>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Activity Logs
              </h1>
              {/* Real-time connection indicator */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                    isRealtimeConnected
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isRealtimeConnected ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  />
                  {isRealtimeConnected ? "Live" : "Connecting"}
                </div>
                {/* New logs notification */}
                {newLogsCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                    <Bell className="w-3 h-3" />
                    {newLogsCount} new
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-muted-foreground text-lg">
            Monitor system activity, user interactions, and data operations with
            real-time WebSocket updates and comprehensive audit trails.
          </p>
        </div>
      </motion.div>

      {/* Stats cards */}
      {summary && (
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
        >
          {/* Total Logs - Most important overview */}
          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 },
            }}
          >
            <Card className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-purple-500/0 border-purple-500/30 dark:border-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 group cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200 transition-colors">
                  Total Logs
                </CardTitle>
                <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                  <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {summary.totalLogs.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Audit Logs - Security & compliance */}
          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 },
            }}
          >
            <Card className="bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 group cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200 transition-colors">
                  Audit Logs
                </CardTitle>
                <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                  <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {summary.totalAudit.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Points Logs - User engagement */}
          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 },
            }}
          >
            <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors">
                  Points Logs
                </CardTitle>
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {summary.totalPoints.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Import Logs - Data management */}
          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 },
            }}
          >
            <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20 hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 group cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors">
                  Import Logs
                </CardTitle>
                <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                  <Database className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  {summary.totalImports.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Upload Logs - File operations */}
          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 },
            }}
          >
            <Card className="bg-gradient-to-br from-teal-500/20 via-teal-500/10 to-teal-500/5 dark:from-teal-500/10 dark:via-teal-500/5 dark:to-teal-500/0 border-teal-500/30 dark:border-teal-500/20 hover:shadow-xl hover:shadow-teal-500/25 transition-all duration-300 group cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-teal-900 dark:text-teal-100 group-hover:text-teal-800 dark:group-hover:text-teal-200 transition-colors">
                  Upload Logs
                </CardTitle>
                <div className="p-2 bg-teal-500/10 rounded-lg group-hover:bg-teal-500/20 transition-colors">
                  <Upload className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-700 dark:text-teal-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {summary.totalUploads.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[100px] max-w-sm">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 bg-primary/10 rounded-md">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <Input
                placeholder="Search logs by user, action, or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            {/* Log Type Filter */}
            <Select value={logType} onValueChange={setLogType}>
              <SelectTrigger className="w-36 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Logs</SelectItem>
                <SelectItem value="points">Points Only</SelectItem>
                <SelectItem value="imports">Imports Only</SelectItem>
                <SelectItem value="audit">Audit Only</SelectItem>
                <SelectItem value="notifications">Notifications</SelectItem>
                <SelectItem value="uploads">Upload Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Entity Type Filter - For finding listing/event changes */}
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-36 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="listing">Listings</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="profile">Profiles</SelectItem>
                <SelectItem value="review">Reviews</SelectItem>
                <SelectItem value="notification">Notifications</SelectItem>
              </SelectContent>
            </Select>

            {/* Entity ID Search - For finding specific listing/event */}
            <Input
              type="text"
              placeholder="Entity ID..."
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-28 h-11 bg-background/50 border-border/50"
            />

            {/* Date Filters */}
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36 h-11 bg-background/50 border-border/50"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36 h-11 bg-background/50 border-border/50"
            />

            {/* Clear Filters Button */}
            {(startDate ||
              endDate ||
              (entityType && entityType !== "all") ||
              entityId ||
              search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setEntityType("all");
                  setEntityId("");
                  setSearch("");
                }}
                className="h-11 text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <div className="flex gap-3 flex-shrink-0">
            <Button
              onClick={handleManualRefresh}
              disabled={loading}
              variant="outline"
              className="h-11 px-6 border-border/50 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>

            <Button
              onClick={handleExport}
              className="h-11 px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
          </div>
        </div>

        {/* Active Filters Info */}
        {(startDate ||
          endDate ||
          (entityType && entityType !== "all") ||
          entityId) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-4">
            <Shield className="h-4 w-4 text-amber-500" />
            <span>
              Filters active: Real-time updates will show as &quot;new logs
              available&quot; badge instead of auto-adding.
              {entityType && entityType !== "all" && (
                <span className="font-medium text-foreground">
                  {" "}
                  Entity: {entityType}
                </span>
              )}
              {entityId && (
                <span className="font-medium text-foreground">
                  {" "}
                  ID: {entityId}
                </span>
              )}
              {startDate && (
                <span className="font-medium text-foreground">
                  {" "}
                  From: {startDate}
                </span>
              )}
              {endDate && (
                <span className="font-medium text-foreground">
                  {" "}
                  To: {endDate}
                </span>
              )}
            </span>
          </div>
        )}
      </motion.div>

      {/* Logs table */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-br from-background/60 to-background/40 backdrop-blur-sm border border-border/50 transition-all duration-300">
          <CardHeader className="pb-6 relative">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-t-xl opacity-50" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    Activity Logs
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    Live system activity and user interactions with real-time
                    WebSocket updates
                    <span className="block text-xs text-muted-foreground mt-1">
                      Last updated:{" "}
                      <ClientLastRefreshFormatter date={lastRefresh} />
                    </span>
                  </CardDescription>
                </div>
              </div>

              {/* Stats indicator */}
              <div className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-muted-foreground">
                  Live Updates
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse"></div>
                </div>
                <div className="mt-6 text-center">
                  <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Loading Activity Logs
                  </h3>
                  <p className="text-muted-foreground">
                    Fetching the latest system activities...
                  </p>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative p-6 bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl mb-6">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl"></div>
                </div>
                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  No Activity Logs Found
                </h3>
                <p className="text-muted-foreground text-center max-w-md leading-relaxed">
                  No logs match your current filters. Try adjusting your search
                  criteria or date range to see more activities.
                </p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="mt-6">
                  <div className="grid grid-cols-12 gap-4 p-3 bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm rounded-lg border border-border/50">
                    <div className="col-span-1">
                      <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                        Type
                      </h4>
                    </div>
                    <div className="col-span-2">
                      <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                        User
                      </h4>
                    </div>
                    <div className="col-span-3">
                      <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                        Details
                      </h4>
                    </div>
                    <div className="col-span-2">
                      <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                        IP & Device
                      </h4>
                    </div>
                    <div className="col-span-2">
                      <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                        Location
                      </h4>
                    </div>
                    <div className="col-span-2">
                      <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                        Timestamp
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Log entries */}
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <motion.div
                      key={`${log.log_type}-${log.id}`}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: index * 0.05,
                        duration: 0.4,
                        ease: [0.4, 0, 0.2, 1],
                      }}
                      whileHover={{
                        scale: 1.01,
                        transition: { duration: 0.2 },
                      }}
                      className="group"
                    >
                      <Card className="bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-sm border border-border/40 hover:border-primary/30 transition-all duration-300 overflow-hidden">
                        {/* Subtle hover background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                        <CardContent className="p-4 relative z-10">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            {/* Type Badge */}
                            <div className="col-span-1">
                              {getLogTypeBadge(log.log_type)}
                            </div>

                            {/* User Info */}
                            <div className="col-span-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-semibold text-primary">
                                    {getUserDisplayName(log)
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {getUserDisplayName(log)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="col-span-3">
                              {formatLogDetails(log)}
                            </div>

                            {/* IP & Device Combined */}
                            <div className="col-span-2">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-mono">
                                  {getIPAddress(log) === "N/A" ? (
                                    <span className="text-muted-foreground/50">
                                      N/A
                                    </span>
                                  ) : (
                                    <span className="text-foreground">
                                      {getIPAddress(log)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {(() => {
                                    const deviceType = getDeviceType(
                                      getUserAgent(log),
                                    );
                                    const isMobile = deviceType === "Mobile";
                                    const isTablet = deviceType === "Tablet";
                                    const isDesktop = deviceType === "Desktop";

                                    return (
                                      <div className="flex items-center gap-1">
                                        {isMobile && (
                                          <span className="text-blue-600">
                                            📱
                                          </span>
                                        )}
                                        {isTablet && (
                                          <span className="text-green-600">
                                            📱
                                          </span>
                                        )}
                                        {isDesktop && (
                                          <span className="text-purple-600">
                                            💻
                                          </span>
                                        )}
                                        <span
                                          className={
                                            deviceType === "Unknown"
                                              ? "text-muted-foreground/50"
                                              : "text-foreground"
                                          }
                                        >
                                          {deviceType}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Location */}
                            <div className="col-span-2">
                              <div className="text-xs text-muted-foreground">
                                {getLocationFromIP(getIPAddress(log)) ===
                                "Unknown" ? (
                                  <span className="text-muted-foreground/50">
                                    Unknown
                                  </span>
                                ) : (
                                  <span className="text-foreground">
                                    {getLocationFromIP(getIPAddress(log))}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Timestamp */}
                            <div className="col-span-2">
                              <div className="text-xs text-muted-foreground">
                                <div className="font-medium">
                                  {format(new Date(log.created_at), "MMM dd")}
                                </div>
                                <div className="text-muted-foreground/70">
                                  <ClientTimeFormatter date={log.created_at} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="mt-8 pt-6 border-t border-border/50"
                  >
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Results info */}
                      <div className="flex items-center gap-3 px-4 py-2 bg-background/60 backdrop-blur-sm rounded-lg border border-border/40">
                        <div className="text-sm text-muted-foreground">
                          Showing{" "}
                          <span className="font-semibold text-foreground">
                            {(pagination.page - 1) * pagination.limit + 1}
                          </span>{" "}
                          to{" "}
                          <span className="font-semibold text-foreground">
                            {Math.min(
                              pagination.page * pagination.limit,
                              pagination.total,
                            )}
                          </span>{" "}
                          of{" "}
                          <span className="font-semibold text-foreground">
                            {pagination.total}
                          </span>{" "}
                          logs
                        </div>
                      </div>

                      {/* Pagination controls */}
                      <div className="flex items-center gap-2">
                        {/* Previous button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page - 1)}
                          disabled={!pagination.hasPrev}
                          className="h-10 px-4 border-border/50 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Previous
                        </Button>

                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                          {Array.from(
                            { length: Math.min(5, pagination.totalPages) },
                            (_, i) => {
                              let pageNum;
                              if (pagination.totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (pagination.page <= 3) {
                                pageNum = i + 1;
                              } else if (
                                pagination.page >=
                                pagination.totalPages - 2
                              ) {
                                pageNum = pagination.totalPages - 4 + i;
                              } else {
                                pageNum = pagination.page - 2 + i;
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={
                                    pageNum === pagination.page
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() => setPage(pageNum)}
                                  className={`h-10 w-10 p-0 ${
                                    pageNum === pagination.page
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                      : "border-border/50 hover:border-primary/50 hover:bg-primary/5"
                                  } transition-all duration-200`}
                                >
                                  {pageNum}
                                </Button>
                              );
                            },
                          )}
                        </div>

                        {/* Next button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page + 1)}
                          disabled={!pagination.hasNext}
                          className="h-10 px-4 border-border/50 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          Next
                          <svg
                            className="w-4 h-4 ml-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
