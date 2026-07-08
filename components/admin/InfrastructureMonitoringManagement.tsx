"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe,
  RefreshCw,
  XCircle,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumStatCard } from "./PremiumStatCard";

interface ApiErrorSummary {
  endpoint: string;
  total_errors: number;
  error_rate: number;
  avg_status_code: number;
  most_recent: string;
  affected_users: number;
}

interface DbHealthTrend {
  check_time: string;
  avg_response_time: number;
  connection_status: string;
  healthy_percentage: number;
}

interface PerformanceSummary {
  metric_type: string;
  page_url: string;
  avg_lcp: number;
  avg_fid: number;
  avg_cls: number;
  avg_page_load_time: number;
  sample_count: number;
}

interface CurrentHealth {
  status: string;
  responseTimeMs: number;
  timestamp: string;
}

export function InfrastructureMonitoringManagement() {
  const [apiErrors, setApiErrors] = React.useState<ApiErrorSummary[]>([]);
  const [dbHealth, setDbHealth] = React.useState<DbHealthTrend[]>([]);
  const [performance, setPerformance] = React.useState<PerformanceSummary[]>(
    []
  );
  const [currentHealth, setCurrentHealth] =
    React.useState<CurrentHealth | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState("24");
  const { toast } = useToast();

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch API errors
      const apiRes = await fetch(
        `/api/monitoring/api-errors?hours=${timeRange}`
      );
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        setApiErrors(apiData.data.summary || []);
      }

      // Fetch database health
      const dbRes = await fetch(
        `/api/monitoring/database-health?hours=${timeRange}`
      );
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDbHealth(dbData.data.trend || []);
        setCurrentHealth(dbData.data.currentHealth || null);
      }

      // Fetch performance metrics
      const perfRes = await fetch(
        `/api/monitoring/performance-metrics?hours=${timeRange}`
      );
      if (perfRes.ok) {
        const perfData = await perfRes.json();
        setPerformance(perfData.data.summary || []);
      }
    } catch (error) {
      console.error("[INFRASTRUCTURE] Error:", error);
      toast({
        title: "Error Loading Data",
        description:
          "Failed to load monitoring data. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  React.useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return {
          icon: CheckCircle2,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
        };
      case "slow":
        return {
          icon: AlertTriangle,
          color: "text-yellow-500",
          bg: "bg-yellow-500/10",
          border: "border-yellow-500/20",
        };
      case "failed":
      case "error":
        return {
          icon: XCircle,
          color: "text-red-500",
          bg: "bg-red-500/10",
          border: "border-red-500/20",
        };
      default:
        return {
          icon: Activity,
          color: "text-gray-500",
          bg: "bg-gray-500/10",
          border: "border-gray-500/20",
        };
    }
  };

  const getLCPRating = (lcp: number) => {
    if (lcp <= 2500) return { color: "text-emerald-500", label: "Good" };
    if (lcp <= 4000)
      return { color: "text-yellow-500", label: "Needs Improvement" };
    return { color: "text-red-500", label: "Poor" };
  };

  const getCLSRating = (cls: number) => {
    if (cls <= 0.1) return { color: "text-emerald-500", label: "Good" };
    if (cls <= 0.25)
      return { color: "text-yellow-500", label: "Needs Improvement" };
    return { color: "text-red-500", label: "Poor" };
  };

  const totalErrors = apiErrors.reduce((sum, e) => sum + e.total_errors, 0);
  const avgResponseTime =
    dbHealth.length > 0
      ? Math.round(
          dbHealth.reduce((sum, h) => sum + h.avg_response_time, 0) /
            dbHealth.length
        )
      : 0;
  const avgLCP =
    performance.length > 0
      ? Math.round(
          performance.reduce((sum, p) => sum + p.avg_lcp, 0) /
            performance.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Time Range:
          </span>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last Hour</SelectItem>
              <SelectItem value="6">Last 6 Hours</SelectItem>
              <SelectItem value="24">Last 24 Hours</SelectItem>
              <SelectItem value="72">Last 3 Days</SelectItem>
              <SelectItem value="168">Last Week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <PremiumStatCard
          title="Total API Errors"
          value={isLoading ? 0 : totalErrors}
          icon={Activity}
          color="red"
          delay={0}
        />

        <PremiumStatCard
          title="DB Response Time"
          value={isLoading ? "0ms" : `${avgResponseTime}ms`}
          icon={Database}
          color="blue"
          delay={1}
        />

        <PremiumStatCard
          title="Avg LCP"
          value={isLoading ? "0ms" : `${avgLCP}ms`}
          icon={Zap}
          color="purple"
          delay={2}
        />

        <PremiumStatCard
          title="Health Checks"
          value={isLoading ? 0 : dbHealth.length}
          icon={CheckCircle2}
          color="green"
          delay={3}
        />
      </div>

      {/* Current Database Health */}
      {currentHealth && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            className={cn(
              "relative overflow-hidden",
              getStatusColor(currentHealth.status).border,
              "bg-gradient-to-br from-card via-card to-card/50 backdrop-blur-sm"
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    getStatusColor(currentHealth.status).bg
                  )}
                >
                  <Database
                    className={cn(
                      "h-5 w-5",
                      getStatusColor(currentHealth.status).color
                    )}
                  />
                </div>
                Current Database Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {React.createElement(
                    getStatusColor(currentHealth.status).icon,
                    {
                      className: cn(
                        "h-8 w-8",
                        getStatusColor(currentHealth.status).color
                      ),
                    }
                  )}
                  <div>
                    <p className="text-2xl font-bold capitalize">
                      {currentHealth.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(currentHealth.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-4xl font-bold",
                      currentHealth.responseTimeMs < 100
                        ? "text-emerald-500"
                        : currentHealth.responseTimeMs < 500
                        ? "text-yellow-500"
                        : "text-red-500"
                    )}
                  >
                    {currentHealth.responseTimeMs}ms
                  </p>
                  <p className="text-sm text-muted-foreground">Response Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs defaultValue="api-errors" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent">
            <TabsTrigger
              value="api-errors"
              className="data-[state=active]:bg-red-500/10"
            >
              <Activity className="h-4 w-4 mr-2" />
              API Errors
            </TabsTrigger>
            <TabsTrigger
              value="database"
              className="data-[state=active]:bg-blue-500/10"
            >
              <Database className="h-4 w-4 mr-2" />
              Database Health
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="data-[state=active]:bg-purple-500/10"
            >
              <Globe className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
          </TabsList>

          {/* API Errors Tab */}
          <TabsContent value="api-errors" className="space-y-4 mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : apiErrors.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 px-4 rounded-2xl border border-dashed border-border/50 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5"
              >
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500 opacity-50" />
                <p className="text-lg font-medium mb-1">No API Errors!</p>
                <p className="text-sm text-muted-foreground">
                  All endpoints are operating normally in the last {timeRange}{" "}
                  hours
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {apiErrors.map((error, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="group hover:border-red-500/30 hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-red-500/5 via-transparent to-transparent">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="font-mono text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-red-500" />
                            {error.endpoint}
                          </span>
                          <Badge
                            variant="destructive"
                            className="animate-pulse"
                          >
                            {error.total_errors} errors
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Error Rate
                            </p>
                            <div className="flex items-baseline gap-1">
                              <p className="text-xl font-bold text-red-500">
                                {error.error_rate.toFixed(2)}%
                              </p>
                              <TrendingUp className="h-3 w-3 text-red-500" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Avg Status
                            </p>
                            <p className="text-xl font-bold">
                              {Math.round(error.avg_status_code)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Affected Users
                            </p>
                            <p className="text-xl font-bold text-orange-500">
                              {error.affected_users}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Most Recent
                            </p>
                            <p className="text-sm font-medium">
                              {new Date(error.most_recent).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Database Health Tab */}
          <TabsContent value="database" className="space-y-4 mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : dbHealth.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 px-4 rounded-2xl border border-dashed border-border/50 bg-gradient-to-br from-yellow-500/5 via-transparent to-yellow-500/5"
              >
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-yellow-500 opacity-50" />
                <p className="text-lg font-medium mb-1">No Health Check Data</p>
                <p className="text-sm text-muted-foreground">
                  No database health checks recorded in the last {timeRange}{" "}
                  hours
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {dbHealth.slice(0, 10).map((check, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={cn(
                        "group hover:shadow-lg transition-all duration-300",
                        getStatusColor(check.connection_status).border,
                        "bg-gradient-to-r from-blue-500/5 via-transparent to-transparent"
                      )}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                getStatusColor(check.connection_status).bg
                              )}
                            >
                              {React.createElement(
                                getStatusColor(check.connection_status).icon,
                                {
                                  className: cn(
                                    "h-5 w-5",
                                    getStatusColor(check.connection_status)
                                      .color
                                  ),
                                }
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">
                                {new Date(check.check_time).toLocaleString()}
                              </p>
                              <p
                                className={cn(
                                  "text-sm capitalize",
                                  getStatusColor(check.connection_status).color
                                )}
                              >
                                {check.connection_status}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                "text-2xl font-bold",
                                check.avg_response_time < 100
                                  ? "text-emerald-500"
                                  : check.avg_response_time < 500
                                  ? "text-yellow-500"
                                  : "text-red-500"
                              )}
                            >
                              {Math.round(check.avg_response_time)}ms
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {check.healthy_percentage.toFixed(1)}% healthy
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4 mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : performance.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 px-4 rounded-2xl border border-dashed border-border/50 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/5"
              >
                <Globe className="h-16 w-16 mx-auto mb-4 text-purple-500 opacity-50" />
                <p className="text-lg font-medium mb-1">No Performance Data</p>
                <p className="text-sm text-muted-foreground">
                  No performance metrics recorded in the last {timeRange} hours
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {performance.map((perf, index) => {
                  const lcpRating = getLCPRating(perf.avg_lcp);
                  const clsRating = getCLSRating(perf.avg_cls);

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="group hover:border-purple-500/30 hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-purple-500/5 via-transparent to-transparent">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between text-base">
                            <span className="font-mono text-sm flex items-center gap-2">
                              <Globe className="h-4 w-4 text-purple-500" />
                              {perf.page_url}
                            </span>
                            <Badge
                              variant="outline"
                              className="bg-purple-500/10 border-purple-500/20"
                            >
                              {perf.sample_count} samples
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                LCP
                              </p>
                              <p
                                className={cn(
                                  "text-xl font-bold",
                                  lcpRating.color
                                )}
                              >
                                {Math.round(perf.avg_lcp)}ms
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {lcpRating.label}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                FID
                              </p>
                              <p className="text-xl font-bold text-blue-500">
                                {Math.round(perf.avg_fid)}ms
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                CLS
                              </p>
                              <p
                                className={cn(
                                  "text-xl font-bold",
                                  clsRating.color
                                )}
                              >
                                {perf.avg_cls.toFixed(3)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {clsRating.label}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Page Load
                              </p>
                              <p className="text-xl font-bold text-indigo-500">
                                {Math.round(perf.avg_page_load_time)}ms
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
