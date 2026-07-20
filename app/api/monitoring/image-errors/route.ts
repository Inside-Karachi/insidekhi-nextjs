import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";

type AuditLogRow = {
  id: string;
  admin_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
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

    // Log to audit_logs table with category "image_error"
    // entity_id is varchar(100), so we hash the URL for unique identification
    const urlHash = crypto
      .createHash("md5")
      .update(imageUrl)
      .digest("hex")
      .substring(0, 32);

    try {
      await query(
        `INSERT INTO public.audit_logs
          (action, entity_type, entity_id, old_values, new_values, user_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "image_load_failed",
          "image_error",
          urlHash,
          { url: imageUrl, page: pathname },
          { error: "Failed to load", timestamp },
          session?.userId || null,
          request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            null,
        ]
      );
    } catch (insertError) {
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Fetch image errors from the past N hours using audit logs
    let errors: AuditLogRow[];
    try {
      const { rows } = await query(
        `SELECT * FROM public.audit_logs
         WHERE action = $1 AND created_at > $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [
          "image_load_failed",
          new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
          limit,
        ]
      );
      errors = rows as AuditLogRow[];
    } catch (fetchError) {
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
