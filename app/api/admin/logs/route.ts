import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await (await createServerSupabase()).auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = await createServerSupabase({ useServiceRole: true });
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!["super_admin", "lister"].includes(profile?.role || "")) {
      return NextResponse.json(
        { error: "Super admin or lister access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const logType = searchParams.get("type") || "all"; // 'all', 'points', 'imports', 'audit', 'uploads', 'notifications'
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const entityType = searchParams.get("entityType"); // 'listing', 'event', 'user', etc.
    const entityId = searchParams.get("entityId"); // Specific entity ID to search for

    // Properly format dates for Supabase queries (include full day range)
    // startDate: beginning of day in UTC
    // endDate: end of day in UTC
    const formattedStartDate = startDate ? `${startDate}T00:00:00.000Z` : null;
    const formattedEndDate = endDate ? `${endDate}T23:59:59.999Z` : null;

    const offset = (page - 1) * limit;

    console.log(
      `[Pagination] Page: ${page}, Limit: ${limit}, Offset: ${offset}`,
    );

    let pointsLogs: Array<{
      id: number;
      user_id: string;
      points: number;
      reason: string | null;
      related_id: number | null;
      created_at: string;
      profiles: {
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
    }> = [];
    let importLogs: Array<{
      id: number;
      import_id: number;
      table_name: string;
      record_id: number;
      record_data: Json;
      rollback_action: string;
      created_at: string;
      import_history: {
        filename: string;
        status: string;
        total_records: number;
        successful_imports: number;
        failed_imports: number;
        import_type: string;
        profiles: {
          full_name: string | null;
          username: string | null;
        } | null;
      } | null;
    }> = [];
    let auditLogs: Array<{
      id: number;
      admin_id: string | null;
      user_id: string | null;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      old_values: Json | null;
      new_values: Json | null;
      metadata: Json | null;
      ip_address: string | null;
      created_at: string;
    }> = [];
    let uploadAuditLogs: Array<{
      id: number;
      submission_id: number | null;
      event: string;
      status: string;
      details: Json | null;
      ip: string | null;
      created_at: string;
    }> = [];
    let totalPoints = 0;
    let totalImports = 0;
    let totalAudit = 0;
    let totalUploads = 0;

    // When entityId or entityType filter is used, only fetch audit logs
    // (points_log, import_rollback_log, upload_audit don't have entity_id/entity_type columns)
    const entityFilterActive = !!(entityId || entityType);

    // Fetch points logs (skip if entity filter is active - points_log has no entity_id)
    if ((logType === "all" || logType === "points") && !entityFilterActive) {
      // First, get the total count without joins for accuracy
      let pointsCountQuery = adminSupabase
        .from("points_log")
        .select("id", { count: "exact", head: true });

      // Apply filters to count query
      if (userId) {
        pointsCountQuery = pointsCountQuery.eq("user_id", userId);
      }
      if (formattedStartDate) {
        pointsCountQuery = pointsCountQuery.gte(
          "created_at",
          formattedStartDate,
        );
      }
      if (formattedEndDate) {
        pointsCountQuery = pointsCountQuery.lte("created_at", formattedEndDate);
      }
      if (search) {
        pointsCountQuery = pointsCountQuery.ilike("reason", `%${search}%`);
      }

      const { count: pointsCount } = await pointsCountQuery;
      totalPoints = pointsCount || 0;

      // Then fetch the actual data with joins
      let pointsQuery = adminSupabase
        .from("points_log")
        .select(
          `
          id,
          user_id,
          points,
          reason,
          related_id,
          created_at,
          profiles:user_id (
            full_name,
            username,
            avatar_url
          )
        `,
        )
        .order("created_at", { ascending: false });

      // Apply filters
      if (userId) {
        pointsQuery = pointsQuery.eq("user_id", userId);
      }
      if (formattedStartDate) {
        pointsQuery = pointsQuery.gte("created_at", formattedStartDate);
      }
      if (formattedEndDate) {
        pointsQuery = pointsQuery.lte("created_at", formattedEndDate);
      }
      if (search) {
        pointsQuery = pointsQuery.ilike("reason", `%${search}%`);
      }

      const { data: pointsData, error: pointsError } = await pointsQuery; // Remove .range() for now

      if (pointsError) {
        console.error("Points logs error:", pointsError);
      } else {
        pointsLogs = pointsData || [];
        console.log(`[Points Logs] Retrieved ${pointsLogs.length} points logs`);
      }
    }

    // Fetch import logs (skip if entity filter is active - import_rollback_log has no entity_id)
    if ((logType === "all" || logType === "imports") && !entityFilterActive) {
      // First, get the total count
      if (userId) {
        // For user_id filter, we need to use join
        let userCountQuery = adminSupabase
          .from("import_rollback_log")
          .select(
            `
            *,
            import_history!inner:user_id
          `,
            { count: "exact", head: true },
          )
          .eq("import_history.user_id", userId);

        if (formattedStartDate) {
          userCountQuery = userCountQuery.gte("created_at", formattedStartDate);
        }
        if (formattedEndDate) {
          userCountQuery = userCountQuery.lte("created_at", formattedEndDate);
        }
        if (search) {
          userCountQuery = userCountQuery.or(
            `table_name.ilike.%${search}%,rollback_action.ilike.%${search}%`,
          );
        }

        const { count } = await userCountQuery;
        totalImports = count || 0;
      } else {
        // No user filter, simpler query
        let importsCountQuery = adminSupabase
          .from("import_rollback_log")
          .select("*", { count: "exact", head: true });

        if (formattedStartDate) {
          importsCountQuery = importsCountQuery.gte(
            "created_at",
            formattedStartDate,
          );
        }
        if (formattedEndDate) {
          importsCountQuery = importsCountQuery.lte(
            "created_at",
            formattedEndDate,
          );
        }
        if (search) {
          importsCountQuery = importsCountQuery.or(
            `table_name.ilike.%${search}%,rollback_action.ilike.%${search}%`,
          );
        }

        const { count: countResult } = await importsCountQuery;
        totalImports = countResult || 0;
      }

      // Then fetch the actual data with joins
      let importsQuery = adminSupabase
        .from("import_rollback_log")
        .select(
          `
          id,
          import_id,
          table_name,
          record_id,
          record_data,
          rollback_action,
          created_at,
          import_history:import_id (
            filename,
            status,
            total_records,
            successful_imports,
            failed_imports,
            import_type,
            profiles:user_id (
              full_name,
              username
            )
          )
        `,
        )
        .order("created_at", { ascending: false });

      // Apply filters
      if (userId) {
        importsQuery = importsQuery.eq("import_history.user_id", userId);
      }
      if (formattedStartDate) {
        importsQuery = importsQuery.gte("created_at", formattedStartDate);
      }
      if (formattedEndDate) {
        importsQuery = importsQuery.lte("created_at", formattedEndDate);
      }
      if (search) {
        importsQuery = importsQuery.or(
          `table_name.ilike.%${search}%,rollback_action.ilike.%${search}%`,
        );
      }

      const { data: importsData, error: importsError } = await importsQuery; // Remove .range() for now

      if (importsError) {
        console.error("Import logs error:", importsError);
      } else {
        importLogs = importsData || [];
        console.log(`[Import Logs] Retrieved ${importLogs.length} import logs`);
      }
    }

    // Fetch audit logs - Use view as single source of truth
    if (
      logType === "all" ||
      logType === "audit" ||
      logType === "notifications"
    ) {
      console.log("[Audit Logs] Using audit_logs_with_profiles view");

      // Get total count from view
      let auditCountQuery = adminSupabase
        .from("audit_logs_with_profiles")
        .select("id", { count: "exact", head: true });

      // Filter for notification-specific logs if requested
      if (logType === "notifications") {
        auditCountQuery = auditCountQuery.in("action", [
          "notification_sent",
          "notification_failed",
        ]);
      }

      // Apply filters to count query
      if (userId) {
        auditCountQuery = auditCountQuery.or(
          `admin_id.eq.${userId},user_id.eq.${userId}`,
        );
      }
      if (formattedStartDate) {
        auditCountQuery = auditCountQuery.gte("created_at", formattedStartDate);
      }
      if (formattedEndDate) {
        auditCountQuery = auditCountQuery.lte("created_at", formattedEndDate);
      }
      if (search) {
        auditCountQuery = auditCountQuery.ilike("action", `%${search}%`);
      }
      // Entity type filter (listing, event, user, etc.)
      if (entityType) {
        auditCountQuery = auditCountQuery.eq("entity_type", entityType);
      }
      // Entity ID filter (specific listing/event ID)
      if (entityId) {
        auditCountQuery = auditCountQuery.eq("entity_id", entityId);
      }

      const { count: auditCount, error: countError } = await auditCountQuery;

      if (countError) {
        console.error("[Audit Logs] Count query failed:", countError);
        // Return error instead of falling back
        return NextResponse.json(
          {
            error: "Failed to fetch audit logs count",
            details: countError.message,
            dataSource: "audit_logs_with_profiles_view",
          },
          { status: 500 },
        );
      }

      totalAudit = auditCount || 0;
      console.log(`[Audit Logs] Found ${totalAudit} total audit logs`);

      // Query audit logs from view (single source of truth)
      let auditQuery = adminSupabase
        .from("audit_logs_with_profiles")
        .select(
          `
          id,
          admin_id,
          user_id,
          action,
          entity_type,
          entity_id,
          old_values,
          new_values,
          metadata,
          ip_address,
          user_agent,
          created_at,
          admin_name,
          admin_username,
          user_name,
          user_username
        `,
        )
        .order("created_at", { ascending: false });

      // Filter for notification-specific logs if requested
      if (logType === "notifications") {
        auditQuery = auditQuery.in("action", [
          "notification_sent",
          "notification_failed",
        ]);
      }

      // Apply filters
      if (userId) {
        auditQuery = auditQuery.or(
          `admin_id.eq.${userId},user_id.eq.${userId}`,
        );
      }
      if (formattedStartDate) {
        auditQuery = auditQuery.gte("created_at", formattedStartDate);
      }
      if (formattedEndDate) {
        auditQuery = auditQuery.lte("created_at", formattedEndDate);
      }
      if (search) {
        auditQuery = auditQuery.ilike("action", `%${search}%`);
      }
      // Entity type filter
      if (entityType) {
        auditQuery = auditQuery.eq("entity_type", entityType);
      }
      // Entity ID filter
      if (entityId) {
        auditQuery = auditQuery.eq("entity_id", entityId);
      }

      const { data: auditData, error: auditError } = await auditQuery; // Remove .range() for now

      if (auditError) {
        console.error("[Audit Logs] Data query failed:", auditError);
        return NextResponse.json(
          {
            error: "Failed to fetch audit logs data",
            details: auditError.message,
            dataSource: "audit_logs_with_profiles_view",
          },
          { status: 500 },
        );
      }

      console.log(
        `[Audit Logs] Retrieved ${
          auditData?.length || 0
        } audit logs from view (before pagination)`,
      );

      // Transform view data (no fallback needed)
      type ViewAuditLog = {
        id: number;
        admin_id: string | null;
        user_id: string | null;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        old_values: Json | null;
        new_values: Json | null;
        metadata: Json | null;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
        admin_name: string | null;
        admin_username: string | null;
        user_name: string | null;
        user_username: string | null;
      };

      auditLogs = ((auditData as ViewAuditLog[]) || []).map((log) => ({
        id: log.id,
        admin_id: log.admin_id,
        user_id: log.user_id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        old_values: log.old_values,
        new_values: log.new_values,
        metadata: log.metadata,
        ip_address: typeof log.ip_address === "string" ? log.ip_address : null,
        user_agent: log.user_agent as string | null,
        created_at: log.created_at as string,
        log_type: "audit" as const,
        admin_profile: log.admin_id
          ? {
              full_name: log.admin_name,
              username: log.admin_username,
              avatar_url: null,
            }
          : null,
        user_profile: log.user_id
          ? {
              full_name: log.user_name,
              username: log.user_username,
              avatar_url: null,
            }
          : null,
      }));

      console.log(
        `[Audit Logs] Transformed ${auditLogs.length} audit logs with profile data`,
      );
    }

    // Fetch upload audit logs (skip if entity filter is active - upload_audit has no entity_id)
    if ((logType === "all" || logType === "uploads") && !entityFilterActive) {
      // First, get the total count
      let uploadsCountQuery = adminSupabase
        .from("upload_audit")
        .select("id", { count: "exact", head: true });

      // Apply filters to count query
      if (formattedStartDate) {
        uploadsCountQuery = uploadsCountQuery.gte(
          "created_at",
          formattedStartDate,
        );
      }
      if (formattedEndDate) {
        uploadsCountQuery = uploadsCountQuery.lte(
          "created_at",
          formattedEndDate,
        );
      }
      if (search) {
        uploadsCountQuery = uploadsCountQuery.or(
          `event.ilike.%${search}%,status.ilike.%${search}%`,
        );
      }

      const { count: uploadsCount } = await uploadsCountQuery;
      totalUploads = uploadsCount || 0;

      // Then fetch the actual data
      let uploadsQuery = adminSupabase
        .from("upload_audit")
        .select(
          `
          id,
          submission_id,
          event,
          status,
          details,
          ip,
          created_at
        `,
        )
        .order("created_at", { ascending: false });

      // Apply filters
      if (formattedStartDate) {
        uploadsQuery = uploadsQuery.gte("created_at", formattedStartDate);
      }
      if (formattedEndDate) {
        uploadsQuery = uploadsQuery.lte("created_at", formattedEndDate);
      }
      if (search) {
        uploadsQuery = uploadsQuery.or(
          `event.ilike.%${search}%,status.ilike.%${search}%`,
        );
      }

      const { data: uploadsData, error: uploadsError } = await uploadsQuery; // Remove .range() for now

      if (uploadsError) {
        console.error("Upload audit logs error:", uploadsError);
      } else {
        uploadAuditLogs = (uploadsData || []).map((log) => ({
          ...log,
          ip: log.ip as string | null,
          created_at: log.created_at as string,
        }));
        console.log(
          `[Upload Logs] Retrieved ${uploadAuditLogs.length} upload logs`,
        );
      }
    }

    // Combine and sort logs
    const allLogs = [
      ...pointsLogs.map((log) => ({ ...log, log_type: "points" })),
      ...importLogs.map((log) => ({ ...log, log_type: "import" })),
      ...auditLogs.map((log) => ({ ...log, log_type: "audit" })),
      ...uploadAuditLogs.map((log) => ({ ...log, log_type: "upload" })),
    ].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    console.log(`[Combined Logs] Total combined logs: ${allLogs.length}`);

    // Apply pagination to combined results
    const paginatedLogs = allLogs.slice(offset, offset + limit);
    const totalLogs = totalPoints + totalImports + totalAudit + totalUploads;

    console.log(
      `[Final Pagination] Page ${page}: showing ${paginatedLogs.length} of ${totalLogs} total logs (offset: ${offset}, limit: ${limit})`,
    );

    return NextResponse.json({
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total: totalLogs,
        totalPages: Math.ceil(totalLogs / limit),
        hasNext: page * limit < totalLogs,
        hasPrev: page > 1,
      },
      summary: {
        totalPoints,
        totalImports,
        totalAudit,
        totalUploads,
        totalLogs,
      },
      dataSource: {
        audit: "audit_logs_with_profiles_view",
        points: "points_log_table",
        imports: "import_rollback_log_table",
        uploads: "upload_audit_table",
      },
    });
  } catch (error) {
    console.error("Logs API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}
