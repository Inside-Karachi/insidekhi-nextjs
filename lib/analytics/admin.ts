import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type {
  AdminAnalyticsOverview,
  AdminViewerRole,
  ConversionFunnelSummary,
  ListingsAnalyticsSummary,
  NotificationsAnalyticsSummary,
  PerformanceAnalyticsSummary,
  PerformanceMetricSummary,
  PerformanceMetricType,
  RevenueAnalyticsSummary,
  RevenueTopEvent,
  RevenueTrendPoint,
  SearchAnalyticsSummary,
  SearchTopQuery,
  SearchTrendPoint,
  TrafficAnalyticsSummary,
  TrafficTrendPoint,
} from "@/types/analytics";

const SEARCH_LOOKBACK_DAYS = 7; // Default fallback only
const SEARCH_EVENT_LIMIT = 1000;
const TRAFFIC_EVENT_LIMIT = 5000;
const BOOKING_EVENT_LIMIT = 4000;
const NOTIFICATION_EVENT_LIMIT = 4000;
const PERFORMANCE_EVENT_LIMIT = 4000;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLIS_PER_HOUR = 60 * 60 * 1000;
const AUTO_REFRESH_INTERVAL_SECONDS = 60;
const PERFORMANCE_LOOKBACK_HOURS = 24;

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabase>>;
type AnalyticsEventRow = Pick<
  Database["public"]["Tables"]["analytics_events"]["Row"],
  "occurred_at" | "context"
>;
type AuditLogRow = Pick<
  Database["public"]["Tables"]["audit_logs"]["Row"],
  "user_id" | "action" | "created_at"
>;
type BookingRow = Pick<
  Database["public"]["Tables"]["bookings"]["Row"],
  "total_amount" | "status" | "payment_status" | "created_at" | "event_id"
>;
type NotificationChannelRow = Pick<
  Database["public"]["Tables"]["notification_channels"]["Row"],
  "channel" | "status" | "attempt_count" | "created_at"
>;
type PerformanceMetricRow = Pick<
  Database["public"]["Tables"]["performance_metrics"]["Row"],
  "metric_type" | "value" | "captured_at"
>;
type EventRow = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "name"
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const buildDateKeys = (now: Date, days: number): string[] => {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * MILLIS_PER_DAY);
    keys.push(toDateKey(date));
  }
  return keys;
};

const clampRatio = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

const normalizeSearchEvents = (
  rows: AnalyticsEventRow[],
  now: Date,
  lookbackDays: number
): SearchAnalyticsSummary => {
  const twentyFourHoursAgo = new Date(now.getTime() - MILLIS_PER_DAY);

  let totalLast24Hours = 0;
  let totalInPeriod = 0;
  let zeroResultCountInPeriod = 0;

  const trendMap = new Map<string, { total: number; zeroResults: number }>();
  const queryMap = new Map<
    string,
    { query: string; count: number; zeroResultCount: number }
  >();

  for (const row of rows) {
    const occurredAt = new Date(row.occurred_at);
    if (Number.isNaN(occurredAt.getTime())) {
      continue;
    }

    const context = isRecord(row.context) ? row.context : {};
    const hasResults =
      typeof context.hasResults === "boolean"
        ? context.hasResults
        : typeof context.resultCount === "number"
        ? context.resultCount > 0
        : true;

    const queryValue = context.query;
    const query = typeof queryValue === "string" ? queryValue.trim() : null;

    if (occurredAt >= twentyFourHoursAgo) {
      totalLast24Hours += 1;
    }

    totalInPeriod += 1;

    if (!hasResults) {
      zeroResultCountInPeriod += 1;
    }

    const dateKey = toDateKey(occurredAt);
    const current = trendMap.get(dateKey) ?? { total: 0, zeroResults: 0 };
    current.total += 1;
    if (!hasResults) {
      current.zeroResults += 1;
    }
    trendMap.set(dateKey, current);

    if (query) {
      const normalizedQuery = query.toLowerCase();
      const entry =
        queryMap.get(normalizedQuery) ??
        ({ query, count: 0, zeroResultCount: 0 } as {
          query: string;
          count: number;
          zeroResultCount: number;
        });

      entry.query = entry.query || query;
      entry.count += 1;
      if (!hasResults) {
        entry.zeroResultCount += 1;
      }

      queryMap.set(normalizedQuery, entry);
    }
  }

  const trend: SearchTrendPoint[] = buildDateKeys(now, lookbackDays).map(
    (date) => {
      const entry = trendMap.get(date) ?? { total: 0, zeroResults: 0 };
      return { date, total: entry.total, zeroResults: entry.zeroResults };
    }
  );

  const topQueries: SearchTopQuery[] = Array.from(queryMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ query, count, zeroResultCount }) => ({
      query,
      count,
      zeroResultCount,
      zeroResultRate: count > 0 ? zeroResultCount / count : 0,
    }));

  return {
    totalLast24Hours,
    totalInPeriod,
    zeroResultCountInPeriod,
    zeroResultRateInPeriod:
      totalInPeriod > 0 ? zeroResultCountInPeriod / totalInPeriod : 0,
    trend,
    topQueries,
  };
};

const summarizeTrafficAnalytics = (
  rows: AuditLogRow[],
  now: Date,
  lookbackDays: number
): TrafficAnalyticsSummary => {
  const dailyThreshold = new Date(now.getTime() - MILLIS_PER_DAY);
  const weeklyThreshold = new Date(
    now.getTime() - lookbackDays * MILLIS_PER_DAY
  );

  const dailyActive = new Set<string>();
  const weeklyActive = new Set<string>();
  let newUsersInPeriod = 0;
  let failedLoginsInPeriod = 0;
  let lastLoginAt: string | null = null;

  const trendMap = new Map<string, { logins: number; signups: number }>();

  for (const row of rows) {
    const createdAt = new Date(row.created_at ?? "");
    if (Number.isNaN(createdAt.getTime())) {
      continue;
    }

    const dateKey = toDateKey(createdAt);
    if (!trendMap.has(dateKey)) {
      trendMap.set(dateKey, { logins: 0, signups: 0 });
    }

    switch (row.action) {
      case "user_login": {
        if (row.user_id) {
          if (createdAt >= weeklyThreshold) {
            weeklyActive.add(row.user_id);
            trendMap.get(dateKey)!.logins += 1;
          }
          if (createdAt >= dailyThreshold) {
            dailyActive.add(row.user_id);
          }
          const iso = createdAt.toISOString();
          if (!lastLoginAt || iso > lastLoginAt) {
            lastLoginAt = iso;
          }
        }
        break;
      }
      case "user_signup": {
        if (createdAt >= weeklyThreshold) {
          newUsersInPeriod += 1;
          trendMap.get(dateKey)!.signups += 1;
        }
        break;
      }
      case "user_login_failed": {
        if (createdAt >= weeklyThreshold) {
          failedLoginsInPeriod += 1;
        }
        break;
      }
      default:
        break;
    }
  }

  const trend: TrafficTrendPoint[] = buildDateKeys(now, lookbackDays).map(
    (date) => {
      const entry = trendMap.get(date) ?? { logins: 0, signups: 0 };
      return { date, logins: entry.logins, signups: entry.signups };
    }
  );

  const weeklyActiveUsers = weeklyActive.size;
  const dailyActiveUsers = dailyActive.size;
  const retentionRate = clampRatio(
    weeklyActiveUsers > 0 ? dailyActiveUsers / weeklyActiveUsers : 0
  );

  return {
    dailyActiveUsers,
    weeklyActiveUsers,
    newUsersInPeriod,
    failedLoginAttemptsInPeriod: failedLoginsInPeriod,
    retentionRate,
    trend,
    lastLoginAt,
  };
};

const summarizeRevenueAnalytics = (
  rows: BookingRow[],
  now: Date,
  periodStartDate: Date,
  lookbackDays: number
): { summary: RevenueAnalyticsSummary; topEventIds: number[] } => {
  const trendMap = new Map<string, { revenue: number; bookings: number }>();
  const eventMap = new Map<number, { revenue: number; bookings: number }>();

  let grossRevenueInPeriod = 0;
  let bookingsPaidInPeriod = 0;
  let refundsInPeriod = 0;
  let pendingPayments = 0;

  for (const row of rows) {
    const createdAt = new Date(row.created_at ?? "");
    if (Number.isNaN(createdAt.getTime())) {
      continue;
    }

    const amount = Number(row.total_amount) || 0;
    const paymentStatus = row.payment_status;
    const bookingStatus = row.status;

    const isPaid =
      paymentStatus === "paid" ||
      bookingStatus === "completed" ||
      bookingStatus === "confirmed";
    const isRefund = paymentStatus === "refunded";
    const isPending =
      paymentStatus === "awaiting_payment" || paymentStatus === "pending";

    if (isPending) {
      pendingPayments += 1;
    }

    if (createdAt >= periodStartDate) {
      if (isPaid) {
        grossRevenueInPeriod += amount;
        bookingsPaidInPeriod += 1;
      }
      if (isRefund) {
        refundsInPeriod += 1;
      }
    }

    if (isPaid) {
      const dateKey = toDateKey(createdAt);
      const trendEntry = trendMap.get(dateKey) ?? { revenue: 0, bookings: 0 };
      trendEntry.revenue += amount;
      trendEntry.bookings += 1;
      trendMap.set(dateKey, trendEntry);

      if (typeof row.event_id === "number") {
        const eventEntry = eventMap.get(row.event_id) ?? {
          revenue: 0,
          bookings: 0,
        };
        eventEntry.revenue += amount;
        eventEntry.bookings += 1;
        eventMap.set(row.event_id, eventEntry);
      }
    }
  }

  const trend: RevenueTrendPoint[] = buildDateKeys(now, lookbackDays).map(
    (date) => {
      const entry = trendMap.get(date) ?? { revenue: 0, bookings: 0 };
      return { date, revenue: entry.revenue, bookings: entry.bookings };
    }
  );

  const topEvents: RevenueTopEvent[] = Array.from(eventMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([eventId, stats]) => ({
      eventId,
      eventName: `Event #${eventId}`,
      revenue: stats.revenue,
      bookings: stats.bookings,
    }));

  const averageOrderValueInPeriod =
    bookingsPaidInPeriod > 0 ? grossRevenueInPeriod / bookingsPaidInPeriod : 0;

  return {
    summary: {
      grossRevenueInPeriod,
      bookingsPaidInPeriod,
      averageOrderValueInPeriod,
      refundsInPeriod,
      pendingPayments,
      revenueTrend: trend,
      topEvents,
    },
    topEventIds: topEvents.map((entry) => entry.eventId),
  };
};

const summarizeNotificationAnalytics = (
  rows: NotificationChannelRow[],
  pendingOutboxCount: number
): NotificationsAnalyticsSummary => {
  let sentInPeriod = 0;
  let failedInPeriod = 0;
  let attemptsTotal = 0;
  let attemptsSamples = 0;
  let lastDispatchAt: string | null = null;

  const channelMap = new Map<
    string,
    { sent: number; failed: number; pending: number }
  >();

  for (const row of rows) {
    const channel = row.channel;
    const status = row.status;
    const attemptCount = Number(row.attempt_count) || 0;
    const bucket = channelMap.get(channel) ?? {
      sent: 0,
      failed: 0,
      pending: 0,
    };

    switch (status) {
      case "sent": {
        bucket.sent += 1;
        sentInPeriod += 1;
        attemptsTotal += attemptCount;
        attemptsSamples += 1;
        if (!lastDispatchAt || row.created_at > lastDispatchAt) {
          lastDispatchAt = row.created_at;
        }
        break;
      }
      case "failed": {
        bucket.failed += 1;
        failedInPeriod += 1;
        attemptsTotal += attemptCount;
        attemptsSamples += 1;
        break;
      }
      case "pending":
      case "processing": {
        bucket.pending += 1;
        break;
      }
      default:
        break;
    }

    channelMap.set(channel, bucket);
  }

  const deliverySuccessRate = clampRatio(
    sentInPeriod + failedInPeriod > 0
      ? sentInPeriod / (sentInPeriod + failedInPeriod)
      : 0
  );
  const averageAttemptCount =
    attemptsSamples > 0 ? attemptsTotal / attemptsSamples : 0;

  const channelBreakdown = Array.from(channelMap.entries())
    .map(([channel, bucket]) => ({
      channel,
      sent: bucket.sent,
      failed: bucket.failed,
      pending: bucket.pending,
    }))
    .sort((a, b) => b.sent - a.sent);

  return {
    sentInPeriod,
    failedInPeriod,
    pendingNow: pendingOutboxCount ?? 0,
    deliverySuccessRate,
    averageAttemptCount,
    lastDispatchAt,
    channelBreakdown,
  };
};

const PERFORMANCE_METADATA: Record<
  PerformanceMetricType,
  { label: string; unit: "ms" | "ratio"; target?: number }
> = {
  lcp: { label: "Largest Contentful Paint", unit: "ms", target: 2500 },
  ttfb: { label: "Time to First Byte", unit: "ms", target: 800 },
  api_latency: { label: "API Latency", unit: "ms", target: 400 },
  api_error_rate: { label: "API Error Rate", unit: "ratio", target: 0.01 },
};

const summarizePerformanceMetrics = (
  rows: PerformanceMetricRow[]
): PerformanceAnalyticsSummary => {
  const accumulator = new Map<
    PerformanceMetricType,
    { total: number; count: number }
  >();
  let capturedUntil: string | null = null;

  for (const row of rows) {
    const metric = row.metric_type as PerformanceMetricType;
    if (!(metric in PERFORMANCE_METADATA)) {
      continue;
    }

    const current = accumulator.get(metric) ?? { total: 0, count: 0 };
    current.total += Number(row.value) || 0;
    current.count += 1;
    accumulator.set(metric, current);

    if (!capturedUntil || row.captured_at > capturedUntil) {
      capturedUntil = row.captured_at;
    }
  }

  const metrics: PerformanceMetricSummary[] = (
    Object.entries(PERFORMANCE_METADATA) as [
      PerformanceMetricType,
      { label: string; unit: "ms" | "ratio"; target?: number }
    ][]
  ).map(([metric, meta]) => {
    const entry = accumulator.get(metric);
    const average = entry && entry.count > 0 ? entry.total / entry.count : null;
    return {
      metric,
      label: meta.label,
      average,
      unit: meta.unit,
      target: meta.target,
    };
  });

  return {
    metrics,
    sampleCount: rows.length,
    capturedUntil,
  };
};

const fetchListingsSummary = async (
  client: SupabaseServerClient,
  periodStartIso: string
): Promise<ListingsAnalyticsSummary> => {
  // All counts now filtered by the selected date range period
  const [
    { count: published = 0 },
    { count: pendingApproval = 0 },
    { count: drafts = 0 },
    { count: rejected = 0 },
    { count: archived = 0 },
  ] = await Promise.all([
    client
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("created_at", periodStartIso),
    client
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")
      .gte("created_at", periodStartIso),
    client
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .gte("created_at", periodStartIso),
    client
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected")
      .gte("created_at", periodStartIso),
    client
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "archived")
      .gte("created_at", periodStartIso),
  ]);

  return {
    published: published ?? 0,
    pendingApproval: pendingApproval ?? 0,
    drafts: drafts ?? 0,
    rejected: rejected ?? 0,
    archived: archived ?? 0,
    publishedInPeriod: published ?? 0,
  };
};

const fetchFunnelSummary = async (
  client: SupabaseServerClient,
  periodStartIso: string
): Promise<ConversionFunnelSummary> => {
  // All funnel counts filtered by the selected date range period
  const [
    { count: getListedSubmissionsInPeriod = 0 },
    { count: membershipSubmissionsInPeriod = 0 },
    { count: bookingsStartedInPeriod = 0 },
    { count: bookingsCompletedInPeriod = 0 },
  ] = await Promise.all([
    client
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("form_type", "get-listed")
      .gte("submitted_at", periodStartIso),
    client
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("form_type", "membership")
      .gte("submitted_at", periodStartIso),
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", periodStartIso),
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", periodStartIso),
  ]);

  const conversionDenominator = Math.max(bookingsStartedInPeriod ?? 0, 1);
  const bookingConversionRate =
    bookingsCompletedInPeriod && conversionDenominator > 0
      ? (bookingsCompletedInPeriod ?? 0) / conversionDenominator
      : 0;

  return {
    getListedSubmissionsInPeriod: getListedSubmissionsInPeriod ?? 0,
    membershipSubmissionsInPeriod: membershipSubmissionsInPeriod ?? 0,
    bookingsStartedInPeriod: bookingsStartedInPeriod ?? 0,
    bookingsCompletedInPeriod: bookingsCompletedInPeriod ?? 0,
    bookingConversionRate,
  };
};

export async function getAdminAnalyticsOverview({
  viewerRole = "admin",
  dateRange,
}: {
  viewerRole?: AdminViewerRole;
  dateRange?: import("@/types/analytics").DateRangeFilter;
} = {}): Promise<AdminAnalyticsOverview> {
  const adminSupabase = await createServerSupabase({ useServiceRole: true });

  const now = new Date();

  // Calculate lookback dates based on dateRange preset or use defaults
  let startDate: Date;
  // _endDate reserved for future custom range queries
  let _endDate = now;

  if (dateRange) {
    switch (dateRange.preset) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * MILLIS_PER_DAY);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * MILLIS_PER_DAY);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * MILLIS_PER_DAY);
        break;
      case "custom":
        if (dateRange.startDate && dateRange.endDate) {
          startDate = new Date(dateRange.startDate);
          _endDate = new Date(dateRange.endDate);
        } else {
          startDate = new Date(
            now.getTime() - SEARCH_LOOKBACK_DAYS * MILLIS_PER_DAY
          );
        }
        break;
      default:
        startDate = new Date(
          now.getTime() - SEARCH_LOOKBACK_DAYS * MILLIS_PER_DAY
        );
    }
  } else {
    startDate = new Date(now.getTime() - SEARCH_LOOKBACK_DAYS * MILLIS_PER_DAY);
  }

  // Calculate period-agnostic variables
  const periodStartIso = startDate.toISOString();
  const lookbackDays = Math.ceil(
    (now.getTime() - startDate.getTime()) / MILLIS_PER_DAY
  );
  const performanceLookback = new Date(
    now.getTime() - PERFORMANCE_LOOKBACK_HOURS * MILLIS_PER_HOUR
  ).toISOString();

  const [
    { data: searchData, error: searchError },
    listings,
    funnels,
    { data: auditRows, error: auditError },
    { data: bookingRows, error: bookingError },
    { data: notificationRows, error: notificationError },
    { count: pendingOutboxCount = 0, error: outboxError },
    performanceResponse,
  ] = await Promise.all([
    adminSupabase
      .from("analytics_events")
      .select("occurred_at, context")
      .eq("event_type", "search_performed")
      .gte("occurred_at", periodStartIso)
      .order("occurred_at", { ascending: true })
      .limit(SEARCH_EVENT_LIMIT),
    fetchListingsSummary(adminSupabase, periodStartIso),
    fetchFunnelSummary(adminSupabase, periodStartIso),
    adminSupabase
      .from("audit_logs")
      .select("user_id, action, created_at")
      .in("action", ["user_login", "user_signup", "user_login_failed"])
      .gte("created_at", periodStartIso)
      .order("created_at", { ascending: true })
      .limit(TRAFFIC_EVENT_LIMIT),
    adminSupabase
      .from("bookings")
      .select("total_amount, status, payment_status, created_at, event_id")
      .gte("created_at", periodStartIso)
      .order("created_at", { ascending: true })
      .limit(BOOKING_EVENT_LIMIT),
    adminSupabase
      .from("notification_channels")
      .select("channel, status, attempt_count, created_at")
      .gte("created_at", periodStartIso)
      .order("created_at", { ascending: true })
      .limit(NOTIFICATION_EVENT_LIMIT),
    adminSupabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .neq("status", "sent"),
    viewerRole === "super_admin"
      ? adminSupabase
          .from("performance_metrics")
          .select("metric_type, value, captured_at")
          .gte("captured_at", performanceLookback)
          .in("metric_type", ["lcp", "ttfb", "api_latency", "api_error_rate"])
          .order("captured_at", { ascending: true })
          .limit(PERFORMANCE_EVENT_LIMIT)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (searchError) {
    console.error("Failed to fetch search analytics events", searchError);
  }
  if (auditError) {
    console.error("Failed to fetch audit log analytics", auditError);
  }
  if (bookingError) {
    console.error("Failed to fetch booking analytics", bookingError);
  }
  if (notificationError) {
    console.error("Failed to fetch notification analytics", notificationError);
  }
  if (outboxError) {
    console.error("Failed to fetch notification outbox status", outboxError);
  }
  if (performanceResponse?.error) {
    console.error(
      "Failed to fetch performance metrics",
      performanceResponse.error
    );
  }

  const searchRows = (searchData ?? []) as AnalyticsEventRow[];
  const searchSummary = normalizeSearchEvents(searchRows, now, lookbackDays);

  const trafficSummary = summarizeTrafficAnalytics(
    (auditRows ?? []) as AuditLogRow[],
    now,
    lookbackDays
  );

  const { summary: revenueSummary, topEventIds } = summarizeRevenueAnalytics(
    (bookingRows ?? []) as BookingRow[],
    now,
    startDate,
    lookbackDays
  );

  const notificationsSummary = summarizeNotificationAnalytics(
    (notificationRows ?? []) as NotificationChannelRow[],
    pendingOutboxCount ?? 0
  );

  let performanceSummary: PerformanceAnalyticsSummary | null = null;
  if (viewerRole === "super_admin" && performanceResponse?.data) {
    performanceSummary = summarizePerformanceMetrics(
      performanceResponse.data as PerformanceMetricRow[]
    );
  }

  if (topEventIds.length > 0) {
    const { data: eventRows, error: eventsError } = await adminSupabase
      .from("events")
      .select("id, name")
      .in("id", topEventIds);
    if (eventsError) {
      console.error(
        "Failed to fetch event names for revenue analytics",
        eventsError
      );
    } else if (eventRows) {
      const nameMap = new Map<number, string>();
      (eventRows as EventRow[]).forEach((row) => {
        nameMap.set(row.id, row.name);
      });
      revenueSummary.topEvents = revenueSummary.topEvents.map((event) => ({
        ...event,
        eventName: nameMap.get(event.eventId) ?? event.eventName,
      }));
    }
  }

  const overview: AdminAnalyticsOverview = {
    viewerRole,
    refreshIntervalSeconds: AUTO_REFRESH_INTERVAL_SECONDS,
    dateRange,
    search: searchSummary,
    listings,
    funnels,
    traffic: trafficSummary,
    revenue: revenueSummary,
    notifications: notificationsSummary,
    performance: viewerRole === "super_admin" ? performanceSummary : null,
    generatedAt: now.toISOString(),
  };

  return overview;
}
