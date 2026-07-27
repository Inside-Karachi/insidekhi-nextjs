import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Json } from "@/types/supabase";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  try {
    // Check admin authentication
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

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

    // Properly format dates (include full day range)
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
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (userId) {
        conditions.push(`pl.user_id = $${idx}`);
        params.push(userId);
        idx++;
      }
      if (formattedStartDate) {
        conditions.push(`pl.created_at >= $${idx}`);
        params.push(formattedStartDate);
        idx++;
      }
      if (formattedEndDate) {
        conditions.push(`pl.created_at <= $${idx}`);
        params.push(formattedEndDate);
        idx++;
      }
      if (search) {
        conditions.push(`pl.reason ILIKE $${idx}`);
        params.push(`%${search}%`);
        idx++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Count
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM public.points_log pl ${whereClause}`,
        params
      );
      totalPoints = (countRows[0] as { count: number })?.count ?? 0;

      // Data with joined profile
      try {
        const { rows: pointsData } = await query(
          `SELECT
            pl.id, pl.user_id, pl.points, pl.reason, pl.related_id, pl.created_at,
            p.full_name AS profile_full_name,
            p.username AS profile_username,
            p.avatar_url AS profile_avatar_url
           FROM public.points_log pl
           LEFT JOIN public.profiles p ON p.id = pl.user_id
           ${whereClause}
           ORDER BY pl.created_at DESC`,
          params
        );
        pointsLogs = pointsData.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          points: row.points,
          reason: row.reason,
          related_id: row.related_id,
          created_at: row.created_at,
          profiles: row.profile_full_name !== null || row.profile_username !== null || row.profile_avatar_url !== null
            ? {
                full_name: row.profile_full_name,
                username: row.profile_username,
                avatar_url: row.profile_avatar_url,
              }
            : null,
        }));
        console.log(`[Points Logs] Retrieved ${pointsLogs.length} points logs`);
      } catch (pointsError) {
        console.error("Points logs error:", pointsError);
      }
    }

    // Fetch import logs (skip if entity filter is active - import_rollback_log has no entity_id)
    if ((logType === "all" || logType === "imports") && !entityFilterActive) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      let joinClause = "";

      if (userId) {
        joinClause = "JOIN public.import_history ih ON ih.id = irl.import_id";
        conditions.push(`ih.user_id = $${idx}`);
        params.push(userId);
        idx++;
      }
      if (formattedStartDate) {
        conditions.push(`irl.created_at >= $${idx}`);
        params.push(formattedStartDate);
        idx++;
      }
      if (formattedEndDate) {
        conditions.push(`irl.created_at <= $${idx}`);
        params.push(formattedEndDate);
        idx++;
      }
      if (search) {
        conditions.push(
          `(irl.table_name ILIKE $${idx} OR irl.rollback_action ILIKE $${idx})`
        );
        params.push(`%${search}%`);
        idx++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM public.import_rollback_log irl ${joinClause} ${whereClause}`,
        params
      );
      totalImports = (countRows[0] as { count: number })?.count ?? 0;

      try {
        const { rows: importsData } = await query(
          `SELECT
            irl.id, irl.import_id, irl.table_name, irl.record_id, irl.record_data,
            irl.rollback_action, irl.created_at,
            ih.filename AS ih_filename,
            ih.status AS ih_status,
            ih.total_records AS ih_total_records,
            ih.successful_imports AS ih_successful_imports,
            ih.failed_imports AS ih_failed_imports,
            ih.import_type AS ih_import_type,
            p.full_name AS ih_profile_full_name,
            p.username AS ih_profile_username
           FROM public.import_rollback_log irl
           LEFT JOIN public.import_history ih ON ih.id = irl.import_id
           LEFT JOIN public.profiles p ON p.id = ih.user_id
           ${whereClause}
           ORDER BY irl.created_at DESC`,
          params
        );
        importLogs = importsData.map((row) => ({
          id: row.id,
          import_id: row.import_id,
          table_name: row.table_name,
          record_id: row.record_id,
          record_data: row.record_data,
          rollback_action: row.rollback_action,
          created_at: row.created_at,
          import_history: row.ih_filename
            ? {
                filename: row.ih_filename,
                status: row.ih_status,
                total_records: row.ih_total_records,
                successful_imports: row.ih_successful_imports,
                failed_imports: row.ih_failed_imports,
                import_type: row.ih_import_type,
                profiles: row.ih_profile_full_name !== null || row.ih_profile_username !== null
                  ? {
                      full_name: row.ih_profile_full_name,
                      username: row.ih_profile_username,
                    }
                  : null,
              }
            : null,
        }));
        console.log(`[Import Logs] Retrieved ${importLogs.length} import logs`);
      } catch (importsError) {
        console.error("Import logs error:", importsError);
      }
    }

    // Fetch audit logs - Use view as single source of truth
    if (
      logType === "all" ||
      logType === "audit" ||
      logType === "notifications"
    ) {
      console.log("[Audit Logs] Using audit_logs_with_profiles view");

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (logType === "notifications") {
        conditions.push(`action IN ($${idx}, $${idx + 1})`);
        params.push("notification_sent", "notification_failed");
        idx += 2;
      }
      if (userId) {
        conditions.push(`(admin_id = $${idx} OR user_id = $${idx})`);
        params.push(userId);
        idx++;
      }
      if (formattedStartDate) {
        conditions.push(`created_at >= $${idx}`);
        params.push(formattedStartDate);
        idx++;
      }
      if (formattedEndDate) {
        conditions.push(`created_at <= $${idx}`);
        params.push(formattedEndDate);
        idx++;
      }
      if (search) {
        conditions.push(`action ILIKE $${idx}`);
        params.push(`%${search}%`);
        idx++;
      }
      if (entityType) {
        conditions.push(`entity_type = $${idx}`);
        params.push(entityType);
        idx++;
      }
      if (entityId) {
        conditions.push(`entity_id = $${idx}`);
        params.push(entityId);
        idx++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      try {
        const { rows: countRows } = await query(
          `SELECT COUNT(*)::int AS count FROM public.audit_logs_with_profiles ${whereClause}`,
          params
        );
        totalAudit = (countRows[0] as { count: number })?.count ?? 0;
      } catch (countError) {
        console.error("[Audit Logs] Count query failed:", countError);
        return NextResponse.json(
          {
            error: "Failed to fetch audit logs count",
            details: countError instanceof Error ? countError.message : String(countError),
            dataSource: "audit_logs_with_profiles_view",
          },
          { status: 500 },
        );
      }

      console.log(`[Audit Logs] Found ${totalAudit} total audit logs`);

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

      let auditData: ViewAuditLog[];
      try {
        const { rows } = await query(
          `SELECT
            id, admin_id, user_id, action, entity_type, entity_id,
            old_values, new_values, metadata, ip_address, user_agent, created_at,
            admin_name, admin_username, user_name, user_username
           FROM public.audit_logs_with_profiles
           ${whereClause}
           ORDER BY created_at DESC`,
          params
        );
        auditData = rows as ViewAuditLog[];
      } catch (auditError) {
        console.error("[Audit Logs] Data query failed:", auditError);
        return NextResponse.json(
          {
            error: "Failed to fetch audit logs data",
            details: auditError instanceof Error ? auditError.message : String(auditError),
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

      auditLogs = (auditData || []).map((log) => ({
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
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (formattedStartDate) {
        conditions.push(`created_at >= $${idx}`);
        params.push(formattedStartDate);
        idx++;
      }
      if (formattedEndDate) {
        conditions.push(`created_at <= $${idx}`);
        params.push(formattedEndDate);
        idx++;
      }
      if (search) {
        conditions.push(`(event ILIKE $${idx} OR status ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM public.upload_audit ${whereClause}`,
        params
      );
      totalUploads = (countRows[0] as { count: number })?.count ?? 0;

      try {
        const { rows: uploadsData } = await query(
          `SELECT id, submission_id, event, status, details, ip::text AS ip, created_at
           FROM public.upload_audit
           ${whereClause}
           ORDER BY created_at DESC`,
          params
        );
        uploadAuditLogs = uploadsData.map((log) => ({
          ...log,
          ip: log.ip as string | null,
          created_at: log.created_at as string,
        }));
        console.log(
          `[Upload Logs] Retrieved ${uploadAuditLogs.length} upload logs`,
        );
      } catch (uploadsError) {
        console.error("Upload audit logs error:", uploadsError);
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
