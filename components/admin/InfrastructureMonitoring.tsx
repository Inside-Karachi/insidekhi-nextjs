"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export function InfrastructureMonitoring() {
  const [apiErrors, setApiErrors] = useState<ApiErrorSummary[]>([]);
  const [dbHealth, setDbHealth] = useState<DbHealthTrend[]>([]);
  const [performance, setPerformance] = useState<PerformanceSummary[]>([]);
  const [currentHealth, setCurrentHealth] = useState<CurrentHealth | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
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

        setLastRefresh(new Date());
      } catch (error) {
        console.error("Failed to fetch monitoring data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timeRange]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "slow":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "failed":
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500">Healthy</Badge>;
      case "slow":
        return <Badge className="bg-yellow-500">Slow</Badge>;
      case "failed":
      case "error":
        return <Badge className="bg-red-500">Failed</Badge>;
      default:
        return <Badge className="bg-gray-500">Unknown</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLCPRating = (lcp: number) => {
    if (lcp <= 2500) return "text-green-500";
    if (lcp <= 4000) return "text-yellow-500";
    return "text-red-500";
  };

  const getCLSRating = (cls: number) => {
    if (cls <= 0.1) return "text-green-500";
    if (cls <= 0.25) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Infrastructure Monitoring</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <Button
            onClick={() => window.location.reload()}
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Current Database Health Card */}
      {currentHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Current Database Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getStatusIcon(currentHealth.status)}
                {getStatusBadge(currentHealth.status)}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {currentHealth.responseTimeMs}ms
                </p>
                <p className="text-sm text-muted-foreground">Response Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different monitoring sections */}
      <Tabs defaultValue="api-errors" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="api-errors">API Errors</TabsTrigger>
          <TabsTrigger value="database">Database Health</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* API Errors Tab */}
        <TabsContent value="api-errors" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </CardContent>
            </Card>
          ) : apiErrors.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No API errors in the last {timeRange} hours
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {apiErrors.map((error, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="font-mono text-sm">
                        {error.endpoint}
                      </span>
                      <Badge variant="destructive">{error.total_errors}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Error Rate
                        </p>
                        <p className="text-lg font-semibold">
                          {error.error_rate.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Avg Status Code
                        </p>
                        <p className="text-lg font-semibold">
                          {Math.round(error.avg_status_code)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Affected Users
                        </p>
                        <p className="text-lg font-semibold">
                          {error.affected_users}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Most Recent
                        </p>
                        <p className="text-sm">
                          {formatTimestamp(error.most_recent)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Database Health Tab */}
        <TabsContent value="database" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </CardContent>
            </Card>
          ) : dbHealth.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No health check data available
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {dbHealth.slice(0, 10).map((check, index) => (
                <Card key={index}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(check.connection_status)}
                        <div>
                          <p className="font-semibold">
                            {formatTimestamp(check.check_time)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {check.connection_status}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {Math.round(check.avg_response_time)}ms
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {check.healthy_percentage.toFixed(1)}% healthy
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </CardContent>
            </Card>
          ) : performance.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Globe className="mx-auto h-12 w-12 text-blue-500" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No performance data in the last {timeRange} hours
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {performance.map((perf, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="font-mono text-sm">{perf.page_url}</span>
                      <Badge>{perf.sample_count} samples</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-sm text-muted-foreground">LCP</p>
                        <p
                          className={`text-lg font-semibold ${getLCPRating(
                            perf.avg_lcp
                          )}`}
                        >
                          {Math.round(perf.avg_lcp)}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">FID</p>
                        <p className="text-lg font-semibold">
                          {Math.round(perf.avg_fid)}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">CLS</p>
                        <p
                          className={`text-lg font-semibold ${getCLSRating(
                            perf.avg_cls
                          )}`}
                        >
                          {perf.avg_cls.toFixed(3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Page Load
                        </p>
                        <p className="text-lg font-semibold">
                          {Math.round(perf.avg_page_load_time)}ms
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
