import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  try {
    const body = await request.json();
    const {
      pageUrl,
      metricType,
      largestContentfulPaintMs,
      firstInputDelayMs,
      cumulativeLayoutShift,
      firstContentfulPaintMs,
      timeToFirstByteMs,
      pageLoadTimeMs,
      domInteractiveMs,
      domCompleteMs,
      resourceCount,
      totalResourceSizeBytes,
      deviceType,
      networkType,
      connectionRttMs,
      countryCode,
      region,
      city,
      source,
    } = body;

    // Validate required fields
    if (!pageUrl || !metricType || !source) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Log performance metric
    try {
      await query(
        `INSERT INTO public.system_performance_metrics
          (page_url, metric_type, largest_contentful_paint_ms, first_input_delay_ms,
           cumulative_layout_shift, first_contentful_paint_ms, time_to_first_byte_ms,
           page_load_time_ms, dom_interactive_ms, dom_complete_ms, resource_count,
           total_resource_size_bytes, device_type, network_type, connection_rtt_ms,
           country_code, region, city, user_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          pageUrl,
          metricType,
          largestContentfulPaintMs || null,
          firstInputDelayMs || null,
          cumulativeLayoutShift || null,
          firstContentfulPaintMs || null,
          timeToFirstByteMs || null,
          pageLoadTimeMs || null,
          domInteractiveMs || null,
          domCompleteMs || null,
          resourceCount || null,
          totalResourceSizeBytes || null,
          deviceType || null,
          networkType || null,
          connectionRttMs || null,
          countryCode || null,
          region || null,
          city || null,
          session?.userId || null,
          source,
        ]
      );
    } catch (insertError) {
      console.error("Failed to log performance metric:", insertError);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Performance metric logging failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get performance metrics for super admins
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");

    // Get performance summary using DB function
    let summary;
    try {
      const { rows } = await query(
        "SELECT * FROM get_performance_summary($1)",
        [hours]
      );
      summary = rows;
    } catch (summaryError) {
      console.error("Failed to fetch performance summary:", summaryError);
      return NextResponse.json(
        { error: "Failed to fetch summary" },
        { status: 500 }
      );
    }

    // Get total metrics count
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS count FROM public.system_performance_metrics
       WHERE created_at > $1`,
      [new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()]
    );
    const totalMetrics = (countRows[0] as { count: number })?.count ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: summary || [],
        totalMetrics: totalMetrics || 0,
        timeRange: `${hours} hours`,
      },
    });
  } catch (error) {
    console.error("Performance metrics monitoring GET failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
