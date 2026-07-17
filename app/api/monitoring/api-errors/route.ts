import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { Database } from "@/types/supabase";

type ApiErrorInsert = Database["public"]["Tables"]["api_error_logs"]["Insert"];

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

    // Get user info if available
    const supabase = await createServerSupabase({ useServiceRole: true });

    // Log API error with proper types
    const errorLog: ApiErrorInsert = {
      endpoint,
      method,
      status_code: statusCode,
      error_message: errorMessage || null,
      user_id: session?.userId || null,
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        null,
      user_agent: request.headers.get("user-agent") || null,
      request_body: requestBody || null,
      response_body: responseBody || null,
      request_duration_ms: requestDurationMs || null,
    };

    const { error: insertError } = await supabase
      .from("api_error_logs")
      .insert(errorLog);

    if (insertError) {
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

    // Get error summary using function with correct parameter name
    const { data: summary, error: summaryError } = await adminSupabase.rpc(
      "get_api_error_summary",
      { hours_back: hours }
    );

    if (summaryError) {
      console.error("Failed to fetch API error summary:", summaryError);
      return NextResponse.json(
        { error: "Failed to fetch summary" },
        { status: 500 }
      );
    }

    // Get total error count
    const { count: totalErrors } = await adminSupabase
      .from("api_error_logs")
      .select("*", { count: "exact", head: true })
      .gt(
        "created_at",
        new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      );

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
