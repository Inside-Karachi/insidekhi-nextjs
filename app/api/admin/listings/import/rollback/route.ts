import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      (profile?.role !== "admin" && profile?.role !== "super_admin")
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const adminSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    const { importId } = await request.json();

    if (!importId) {
      return NextResponse.json(
        { error: "Import ID is required" },
        { status: 400 }
      );
    }

    // Check if the import belongs to the user or if user is admin
    const { data: importHistory, error: historyError } = await supabase
      .from("import_history")
      .select("*")
      .eq("id", importId)
      .single();

    if (historyError || !importHistory) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }

    // Check ownership or admin access
    if (
      importHistory.user_id !== user.id &&
      profile?.role !== "admin" &&
      profile?.role !== "super_admin"
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

    const { data: rollbackResult, error: rollbackError } =
      await adminSupabase.rpc("rollback_import", {
        import_id_param: importId,
      });

    if (rollbackError) {
      console.error("Rollback error:", rollbackError);
      return NextResponse.json(
        {
          error: "Rollback failed",
          details: rollbackError.message,
        },
        { status: 500 }
      );
    }

    // Type the rollback result properly
    const result = rollbackResult as {
      success: boolean;
      message: string;
      records_rolled_back: number;
    };

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
    const supabase = await createServerSupabase();

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      (profile?.role !== "admin" && profile?.role !== "super_admin")
    ) {
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

    let query = supabase
      .from("import_history")
      .select(
        `
        *,
        profiles:user_id (
          username,
          full_name,
          role
        )
      `,
        { count: "exact" }
      )
      .order("started_at", { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    // Regular users can only see their own imports, admins can see all
    if (profile?.role !== "admin" && profile?.role !== "super_admin") {
      query = query.eq("user_id", user.id);
    }

    const {
      data: imports,
      error,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching import history:", error);
      return NextResponse.json(
        { error: "Failed to fetch import history" },
        { status: 500 }
      );
    }

    const history = imports || [];
    const total = typeof count === "number" ? count : history.length;
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
