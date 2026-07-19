import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { importId } = await request.json();

    if (!importId) {
      return NextResponse.json(
        { error: "Import ID is required" },
        { status: 400 }
      );
    }

    // Check if the import belongs to the user or if user is admin
    const { rows: importHistoryRows } = await query(
      `SELECT * FROM import_history WHERE id = $1`,
      [importId],
    );
    const importHistory = importHistoryRows[0];

    if (!importHistory) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }

    // Check ownership or admin access
    if (
      importHistory.user_id !== session.userId &&
      profile.role !== "admin" &&
      profile.role !== "super_admin"
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if rollback is available
    if (
      !importHistory.rollback_available ||
      importHistory.status !== "completed"
    ) {
      return NextResponse.json(
        {
          error: "Rollback not available for this import",
          details: `Status: ${importHistory.status}, Rollback available: ${importHistory.rollback_available}`,
        },
        { status: 400 }
      );
    }

    let result: {
      success: boolean;
      message: string;
      records_rolled_back: number;
    };
    try {
      const { rows: rpcRows } = await query(
        `SELECT rollback_import($1::integer) AS result`,
        [importId],
      );
      result = rpcRows[0]?.result;
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
      return NextResponse.json(
        {
          error: "Rollback failed",
          details:
            rollbackError instanceof Error
              ? rollbackError.message
              : "Unknown error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: result.success,
      message: result.message || "Rollback completed successfully",
      recordsRolledBack: result.records_rolled_back || 0,
    });
  } catch (error) {
    console.error("Rollback request error:", error);
    return NextResponse.json(
      {
        error: "Rollback request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve import history
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const parsedOffset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
    const status = searchParams.get("status");

    // Regular users can only see their own imports, admins can see all
    const isAdmin = profile.role === "admin" || profile.role === "super_admin";

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`ih.status = $${params.length}`);
    }
    if (!isAdmin) {
      params.push(session.userId);
      conditions.push(`ih.user_id = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM import_history ih ${whereClause}`,
      params,
    );
    const total = parseInt(countRows[0].count, 10);

    const dataParams = [...params, limit, offset];
    const { rows: imports } = await query(
      `SELECT ih.*, p.username, p.full_name, p.role AS profile_role
       FROM import_history ih
       LEFT JOIN profiles p ON p.id = ih.user_id
       ${whereClause}
       ORDER BY ih.started_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    const history = imports.map((row) => {
      const { username, full_name, profile_role, ...rest } = row;
      return {
        ...rest,
        profiles: username !== null || full_name !== null || profile_role !== null
          ? { username, full_name, role: profile_role }
          : null,
      };
    });

    const currentPage = Math.floor(offset / limit);
    const hasMore = offset + limit < total;

    return NextResponse.json({
      success: true,
      history,
      imports: history,
      pagination: {
        total,
        limit,
        offset,
        page: currentPage,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Import history request error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch import history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
