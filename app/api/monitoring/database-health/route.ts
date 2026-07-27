import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

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

    // Log database health check
    try {
      await query(
        `INSERT INTO public.database_health_checks
          (check_type, connection_status, response_time_ms, error_message,
           active_connections, connection_pool_usage, max_connection_age_ms,
           avg_query_time_ms, slow_query_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          checkType,
          connectionStatus,
          responseTimeMs || null,
          errorMessage || null,
          activeConnections || null,
          connectionPoolUsage || null,
          maxConnectionAgeMs || null,
          avgQueryTimeMs || null,
          slowQueryCount || 0,
        ]
      );
    } catch (insertError) {
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

    // Get health trend using DB function
    let trend;
    try {
      const { rows } = await query(
        "SELECT * FROM get_database_health_trend($1)",
        [hours]
      );
      trend = rows;
    } catch (trendError) {
      console.error("Failed to fetch database health trend:", trendError);
      return NextResponse.json(
        { error: "Failed to fetch trend" },
        { status: 500 }
      );
    }

    // Run a live health check
    const healthCheckStart = Date.now();
    let pingFailed = false;
    try {
      await query("SELECT id FROM public.profiles LIMIT 1");
    } catch {
      pingFailed = true;
    }
    const healthCheckDuration = Date.now() - healthCheckStart;

    const currentHealth = {
      status: pingFailed ? "failed" : "healthy",
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
