import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, timestamp, pathname } = body;

    // Validate input
    if (!imageUrl || !timestamp) {
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

    // Log to audit_logs table with category "image_error"
    // entity_id is varchar(100), so we hash the URL for unique identification
    const urlHash = crypto
      .createHash("md5")
      .update(imageUrl)
      .digest("hex")
      .substring(0, 32);

    const { error: insertError } = await supabase.from("audit_logs").insert({
      action: "image_load_failed",
      entity_type: "image_error",
      entity_id: urlHash, // MD5 hash fits in varchar(100)
      old_values: { url: imageUrl, page: pathname },
      new_values: { error: "Failed to load", timestamp },
      user_id: user?.id || null,
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
    });

    if (insertError) {
      console.error("Failed to log image error:", insertError);
      // Don't fail the request - this is monitoring, not critical
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Image error monitoring failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Endpoint for super admin to fetch image error reports
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Fetch image errors from the past N hours using audit logs
    const { data: errors, error: fetchError } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", "image_load_failed")
      .gt(
        "created_at",
        new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error("Failed to fetch image errors:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch errors" },
        { status: 500 }
      );
    }

    // Group errors by image URL to find patterns
    const errorSummary = (errors || []).reduce(
      (acc, error) => {
        const url =
          (error.new_values as { error?: string } | null)?.error ||
          (error.metadata as { imageUrl?: string } | null)?.imageUrl ||
          "unknown";
        if (!acc[url]) {
          acc[url] = {
            count: 0,
            firstSeen: error.created_at || new Date().toISOString(),
            lastSeen: error.created_at || new Date().toISOString(),
            affectedPages: new Set(),
          };
        }
        acc[url].count++;
        acc[url].lastSeen = error.created_at || new Date().toISOString();
        const page = (error.old_values as { page?: string } | null)?.page;
        if (page) {
          acc[url].affectedPages.add(page);
        }
        return acc;
      },
      {} as Record<
        string,
        {
          count: number;
          firstSeen: string;
          lastSeen: string;
          affectedPages: Set<string>;
        }
      >
    );

    // Convert Sets to arrays for JSON serialization
    const summary = Object.entries(errorSummary).map(([url, data]) => ({
      imageUrl: url,
      errorCount: data.count,
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      affectedPages: Array.from(data.affectedPages),
    }));

    return NextResponse.json({
      success: true,
      data: {
        errors: errors || [],
        summary,
        totalErrors: errors?.length || 0,
        timeRange: `${hours} hours`,
      },
    });
  } catch (error) {
    console.error("Image error monitoring GET failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
