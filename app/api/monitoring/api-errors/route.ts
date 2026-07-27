import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const body = await request.json();
    const {
      endpoint,
      method,
      statusCode,
      errorMessage,
      requestDurationMs,
      requestBody,
      responseBody,
    } = body;

    // Validate required fields
    if (!endpoint || !method || !statusCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Log API error
    try {
      await query(
        `INSERT INTO public.api_error_logs
          (endpoint, method, status_code, error_message, user_id, ip_address,
           user_agent, request_body, response_body, request_duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          endpoint,
          method,
          statusCode,
          errorMessage || null,
          session?.userId || null,
          request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            null,
          request.headers.get("user-agent") || null,
          requestBody || null,
          responseBody || null,
          requestDurationMs || null,
        ]
      );
    } catch (insertError) {
      console.error("Failed to log API error:", insertError);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error logging failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get API error logs for super admins
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

    // Get error summary using DB function
    let summary;
    try {
      const { rows } = await query(
        "SELECT * FROM get_api_error_summary($1)",
        [hours]
      );
      summary = rows;
    } catch (summaryError) {
      console.error("Failed to fetch API error summary:", summaryError);
      return NextResponse.json(
        { error: "Failed to fetch summary" },
        { status: 500 }
      );
    }

    // Get total error count
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS count FROM public.api_error_logs
       WHERE created_at > $1`,
      [new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()]
    );
    const totalErrors = (countRows[0] as { count: number })?.count ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: summary || [],
        totalErrors: totalErrors || 0,
        timeRange: `${hours} hours`,
      },
    });
  } catch (error) {
    console.error("API error monitoring GET failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
