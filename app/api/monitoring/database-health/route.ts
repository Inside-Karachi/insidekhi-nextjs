import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

type DbHealthInsert =
  Database["public"]["Tables"]["database_health_checks"]["Insert"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      checkType,
      connectionStatus,
      responseTimeMs,
      errorMessage,
      activeConnections,
      connectionPoolUsage,
      maxConnectionAgeMs,
      avgQueryTimeMs,
      slowQueryCount,
    } = body;

    // Validate required fields
    if (!checkType || !connectionStatus) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase({ useServiceRole: true });

    // Log database health check with proper types
    const healthCheck: DbHealthInsert = {
      check_type: checkType,
      connection_status: connectionStatus,
      response_time_ms: responseTimeMs || null,
      error_message: errorMessage || null,
      active_connections: activeConnections || null,
      connection_pool_usage: connectionPoolUsage || null,
      max_connection_age_ms: maxConnectionAgeMs || null,
      avg_query_time_ms: avgQueryTimeMs || null,
      slow_query_count: slowQueryCount || 0,
    };

    const { error: insertError } = await supabase
      .from("database_health_checks")
      .insert(healthCheck);

    if (insertError) {
      console.error("Failed to log database health:", insertError);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database health logging failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get database health logs for super admins
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");

    // Use service role to bypass RLS
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get health trend using correct function with proper parameter name
    const { data: trend, error: trendError } = await adminSupabase.rpc(
      "get_database_health_trend",
      { hours_back: hours }
    );

    if (trendError) {
      console.error("Failed to fetch database health trend:", trendError);
      return NextResponse.json(
        { error: "Failed to fetch trend" },
        { status: 500 }
      );
    }

    // Run a live health check
    const healthCheckStart = Date.now();
    const { error: pingError } = await adminSupabase
      .from("profiles")
      .select("id")
      .limit(1)
      .single();
    const healthCheckDuration = Date.now() - healthCheckStart;

    const currentHealth = {
      status: pingError ? "failed" : "healthy",
      responseTimeMs: healthCheckDuration,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        trend: trend || [],
        currentHealth,
        timeRange: `${hours} hours`,
      },
    });
  } catch (error) {
    console.error("Database health monitoring GET failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
