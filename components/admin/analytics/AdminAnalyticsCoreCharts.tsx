"use client";

import { motion } from "framer-motion";
import { BarChartBig } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TopQuery {
  query: string;
  count: number;
  zeroResultRate: number;
}

interface TopRevenueEvent {
  eventId: number;
  eventName: string;
  bookings: number;
  revenue: number;
}

interface AdminAnalyticsCoreChartsProps {
  hasSearchData: boolean;
  hasTrafficData: boolean;
  hasRevenueData: boolean;
  searchTrendData: Array<{ label: string; total: number; zeroResults: number }>;
  trafficTrendData: Array<{ label: string; logins: number; signups: number }>;
  revenueTrendData: Array<{ label: string; revenue: number; bookings: number }>;
  topQueries: TopQuery[];
  topRevenueEvents: TopRevenueEvent[];
  periodLabelSuffix: string;
  revenueSummary: {
    grossRevenueInPeriod: number;
    bookingsPaidInPeriod: number;
    refundsInPeriod: number;
    pendingPayments: number;
  };
  formatNumber: (value: number) => string;
  formatPercent: (value: number) => string;
  formatCurrency: (value: number) => string;
}

const CHART_COLORS = {
  primary: "#ff184d",
  secondary: "#6366f1",
  tertiary: "#22d3ee",
  amber: "#f59e0b",
} as const;

export function AdminAnalyticsCoreCharts({
  hasSearchData,
  hasTrafficData,
  hasRevenueData,
  searchTrendData,
  trafficTrendData,
  revenueTrendData,
  topQueries,
  topRevenueEvents,
  periodLabelSuffix,
  revenueSummary,
  formatNumber,
  formatPercent,
  formatCurrency,
}: AdminAnalyticsCoreChartsProps) {
  return (
    <>
      <section>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-xl md:text-2xl font-bold mb-6">
            Search & <span className="gradient-text-primary">Engagement</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2 border-2 shadow-premium bg-gradient-to-br from-background via-background to-primary/5">
            <CardHeader className="space-y-2 border-b bg-gradient-to-r from-primary/5 via-background to-background">
              <CardTitle className="text-lg font-bold">
                Search engagement
              </CardTitle>
              <CardDescription className="text-sm">
                Aggregate searches with zero-result diagnostics over the past
                week.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="h-[280px] w-full">
                {hasSearchData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={searchTrendData}
                      margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient
                          id="searchGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={CHART_COLORS.primary}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor={CHART_COLORS.primary}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 8"
                        stroke="rgba(148,163,184,0.25)"
                      />
                      <XAxis
                        dataKey="label"
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="Searches"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        fill="url(#searchGradient)"
                      />
                      <Line
                        type="monotone"
                        dataKey="zeroResults"
                        name="Zero-result"
                        stroke={CHART_COLORS.secondary}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="No search telemetry captured for the selected window." />
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  Top search queries
                </h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {topQueries.length === 0 ? (
                    <p className="col-span-2 text-sm text-muted-foreground">
                      No popular queries yet - time to drive discovery.
                    </p>
                  ) : (
                    topQueries.map((query) => (
                      <motion.div
                        key={query.query}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center justify-between rounded-xl border-2 bg-gradient-to-br from-background to-primary/5 px-4 py-3 text-sm shadow-sm hover:shadow-md transition-shadow"
                      >
                        <span className="truncate font-semibold text-foreground">
                          {query.query}
                        </span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {formatNumber(query.count)}
                          <Badge variant="outline" className="text-xs font-semibold">
                            {formatPercent(query.zeroResultRate)} no match
                          </Badge>
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 shadow-premium bg-gradient-to-br from-background via-background to-secondary/5">
            <CardHeader className="space-y-2 border-b bg-gradient-to-r from-secondary/5 via-background to-background">
              <CardTitle className="text-lg font-bold">
                Traffic & growth
              </CardTitle>
              <CardDescription className="text-sm">
                Logins vs new signups to track momentum.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="h-[280px] w-full">
                {hasTrafficData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trafficTrendData}
                      margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 8"
                        stroke="rgba(148,163,184,0.25)"
                      />
                      <XAxis
                        dataKey="label"
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip />
                      <Legend verticalAlign="top" height={32} iconType="circle" />
                      <Line
                        type="monotone"
                        dataKey="logins"
                        name="Logins"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="signups"
                        name="Signups"
                        stroke={CHART_COLORS.tertiary}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="No recent login activity. Keep users engaged to populate this view." />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-xl md:text-2xl font-bold mb-6">
            Revenue & <span className="gradient-text-primary">Ticketing</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2 border-2 shadow-premium bg-gradient-to-br from-background via-background to-emerald-500/5">
            <CardHeader className="space-y-2 border-b bg-gradient-to-r from-emerald-500/5 via-background to-background">
              <CardTitle className="text-lg font-bold">
                Revenue & ticketing
              </CardTitle>
              <CardDescription className="text-sm">
                Gross order value and completed bookings per day.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="h-[280px] w-full">
                {hasRevenueData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={revenueTrendData}
                      margin={{ left: 10, right: 10, top: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient
                          id="revenueGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={CHART_COLORS.secondary}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor={CHART_COLORS.secondary}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 8"
                        stroke="rgba(148,163,184,0.25)"
                      />
                      <XAxis
                        dataKey="label"
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <RechartsTooltip />
                      <Legend verticalAlign="top" height={32} iconType="circle" />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke={CHART_COLORS.secondary}
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                      />
                      <Line
                        type="monotone"
                        dataKey="bookings"
                        name="Paid bookings"
                        stroke={CHART_COLORS.amber}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="No bookings recorded yet. Once transactions arrive, trends will appear here." />
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryPill
                  label={`Gross revenue${periodLabelSuffix}`}
                  value={formatCurrency(revenueSummary.grossRevenueInPeriod)}
                  tone="primary"
                />
                <SummaryPill
                  label={`Paid bookings${periodLabelSuffix}`}
                  value={formatNumber(revenueSummary.bookingsPaidInPeriod)}
                />
                <SummaryPill
                  label={`Refunds issued${periodLabelSuffix}`}
                  value={formatNumber(revenueSummary.refundsInPeriod)}
                  tone={revenueSummary.refundsInPeriod > 0 ? "warning" : "neutral"}
                />
                <SummaryPill
                  label="Pending payments"
                  value={formatNumber(revenueSummary.pendingPayments)}
                  tone={revenueSummary.pendingPayments > 0 ? "warning" : "neutral"}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 shadow-premium bg-gradient-to-br from-background via-background to-amber-500/5">
            <CardHeader className="space-y-2 border-b bg-gradient-to-r from-amber-500/5 via-background to-background">
              <CardTitle className="text-lg font-bold">
                Top revenue events
              </CardTitle>
              <CardDescription className="text-sm">
                Leaders by gross ticket sales.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="h-[280px] w-full">
                {topRevenueEvents.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topRevenueEvents}
                      layout="vertical"
                      margin={{ left: 10, right: 20, top: 15, bottom: 15 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 8"
                        stroke="rgba(148,163,184,0.25)"
                      />
                      <XAxis
                        type="number"
                        stroke="rgba(148,163,184,0.6)"
                        hide
                      />
                      <YAxis
                        type="category"
                        dataKey="eventName"
                        width={180}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 12 }}
                      />
                      <RechartsTooltip />
                      <Bar
                        dataKey="revenue"
                        radius={[6, 6, 6, 6]}
                        fill={CHART_COLORS.primary}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="Revenue leaders will appear once bookings start closing." />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-muted bg-muted/10 text-center text-sm text-muted-foreground">
      <BarChartBig className="h-8 w-8 text-muted-foreground/60" />
      <span>{message}</span>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "primary" | "warning";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-500"
        : "text-foreground";

  const bgClass =
    tone === "primary"
      ? "bg-gradient-to-br from-primary/10 to-primary/5"
      : tone === "warning"
        ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5"
        : "bg-gradient-to-br from-background to-primary/5";

  return (
    <div className={`rounded-2xl border-2 ${bgClass} px-5 py-4 shadow-sm`}>
      <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">
        {label}
      </p>
      <p className={`text-xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
