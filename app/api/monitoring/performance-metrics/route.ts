import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

type PerformanceMetricInsert =
  Database["public"]["Tables"]["system_performance_metrics"]["Insert"];

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

    // Get user info if available
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Log performance metric with proper types
    const metric: PerformanceMetricInsert = {
      page_url: pageUrl,
      metric_type: metricType,
      largest_contentful_paint_ms: largestContentfulPaintMs || null,
      first_input_delay_ms: firstInputDelayMs || null,
      cumulative_layout_shift: cumulativeLayoutShift || null,
      first_contentful_paint_ms: firstContentfulPaintMs || null,
      time_to_first_byte_ms: timeToFirstByteMs || null,
      page_load_time_ms: pageLoadTimeMs || null,
      dom_interactive_ms: domInteractiveMs || null,
      dom_complete_ms: domCompleteMs || null,
      resource_count: resourceCount || null,
      total_resource_size_bytes: totalResourceSizeBytes || null,
      device_type: deviceType || null,
      network_type: networkType || null,
      connection_rtt_ms: connectionRttMs || null,
      country_code: countryCode || null,
      region: region || null,
      city: city || null,
      user_id: session?.userId || null,
      source,
    };

    const { error: insertError } = await supabase
      .from("system_performance_metrics")
      .insert(metric);

    if (insertError) {
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
    const supabase = await createServerSupabase();
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");

    // Use service role to bypass RLS
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get performance summary using function with correct parameter name
    const { data: summary, error: summaryError } = await adminSupabase.rpc(
      "get_performance_summary",
      { hours_back: hours }
    );

    if (summaryError) {
      console.error("Failed to fetch performance summary:", summaryError);
      return NextResponse.json(
        { error: "Failed to fetch summary" },
        { status: 500 }
      );
    }

    // Get total metrics count
    const { count: totalMetrics } = await adminSupabase
      .from("system_performance_metrics")
      .select("*", { count: "exact", head: true })
      .gt(
        "created_at",
        new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      );

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
