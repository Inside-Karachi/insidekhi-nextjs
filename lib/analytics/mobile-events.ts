import { query } from "@/lib/db";

export type MobileEventsSummary = {
  totalLast7d: number;
  screenViewsLast7d: number;
  searchesLast7d: number;
  zeroResultLast7d: number;
};

export type ZeroResultQuery = {
  query: string;
  count: number;
  lastSeen: string;
};

export type RecentMobileEvent = {
  id: string;
  eventName: string;
  occurredAt: string;
  sourceContext: string;
  screen: string | null;
  platform: string | null;
  isAuthenticated: boolean;
};

export type MobileEventsOverview = {
  summary: MobileEventsSummary;
  zeroResultQueries: ZeroResultQuery[];
  recentEvents: RecentMobileEvent[];
};

const SEARCH_EVENT_NAMES = ["search_performed", "filters_applied"];

/**
 * Scoped to public.mobile_events only - deliberately not merged with
 * lib/analytics/admin.ts, which is scoped to the web's separate,
 * enum-typed analytics_events table.
 */
export async function getMobileEventsOverview(): Promise<MobileEventsOverview> {
  const [summaryResult, zeroResultResult, recentResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE occurred_at >= now() - interval '7 days') AS total_last_7d,
         COUNT(*) FILTER (WHERE event_name = 'screen_viewed' AND occurred_at >= now() - interval '7 days') AS screen_views_last_7d,
         COUNT(*) FILTER (WHERE event_name = ANY($1) AND occurred_at >= now() - interval '7 days') AS searches_last_7d,
         COUNT(*) FILTER (WHERE event_name = ANY($1) AND (context->>'hasResults') = 'false' AND occurred_at >= now() - interval '7 days') AS zero_result_last_7d
       FROM public.mobile_events`,
      [SEARCH_EVENT_NAMES],
    ),
    query(
      `SELECT context->>'query' AS query, COUNT(*) AS count, MAX(occurred_at) AS last_seen
       FROM public.mobile_events
       WHERE event_name = ANY($1)
         AND (context->>'hasResults') = 'false'
         AND context->>'query' IS NOT NULL AND context->>'query' != ''
         AND occurred_at >= now() - interval '30 days'
       GROUP BY context->>'query'
       ORDER BY count DESC, last_seen DESC
       LIMIT 20`,
      [SEARCH_EVENT_NAMES],
    ),
    query(
      `SELECT id, event_name, occurred_at, source_context, screen, platform, (user_id IS NOT NULL) AS is_authenticated
       FROM public.mobile_events
       ORDER BY occurred_at DESC
       LIMIT 100`,
    ),
  ]);

  const s = summaryResult.rows[0];
  return {
    summary: {
      totalLast7d: Number(s.total_last_7d),
      screenViewsLast7d: Number(s.screen_views_last_7d),
      searchesLast7d: Number(s.searches_last_7d),
      zeroResultLast7d: Number(s.zero_result_last_7d),
    },
    zeroResultQueries: zeroResultResult.rows.map((r) => ({
      query: r.query,
      count: Number(r.count),
      lastSeen: r.last_seen,
    })),
    recentEvents: recentResult.rows.map((r) => ({
      id: String(r.id),
      eventName: r.event_name,
      occurredAt: r.occurred_at,
      sourceContext: r.source_context,
      screen: r.screen,
      platform: r.platform,
      isAuthenticated: r.is_authenticated,
    })),
  };
}
