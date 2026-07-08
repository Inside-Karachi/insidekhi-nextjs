import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { FormSubmissionWithAssets } from "@/types/form.types";

// GET all form submissions (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify admin role
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["admin", "super_admin", "lister"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const formType = searchParams.get("form_type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const offset = (page - 1) * limit;

    // Build query with service role client to respect RLS bypass
    let query = adminSupabase.from("form_submissions").select("*");

    if (formType) {
      query = query.eq("form_type", formType);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (dateFrom) {
      query = query.gte("submitted_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("submitted_at", dateTo);
    }
    if (search) {
      const sanitized = search.replace(/%/g, "\\%").replace(/,/g, "\\,");
      query = query.or(
        `name.ilike.%${sanitized}%,company_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
      );
    }

    query = query
      .order("submitted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch form submissions" },
        { status: 500 }
      );
    }

    const submissionIds = (data ?? []).map((submission) => submission.id);
    let imagesBySubmission = new Map<
      number,
      Database["public"]["Tables"]["form_submission_images"]["Row"][]
    >();

    if (submissionIds.length > 0) {
      const { data: imageRows, error: imageError } = await adminSupabase
        .from("form_submission_images")
        .select("*")
        .in("submission_id", submissionIds);

      if (imageError) {
        console.error("Failed to fetch submission images:", imageError);
      } else if (imageRows) {
        imagesBySubmission = imageRows.reduce((map, image) => {
          const list = map.get(image.submission_id) ?? [];
          list.push(image);
          map.set(image.submission_id, list);
          return map;
        }, new Map<number, Database["public"]["Tables"]["form_submission_images"]["Row"][]>());
      }
    }

    // Get total count for pagination
    let countQuery = adminSupabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true });

    if (formType) {
      countQuery = countQuery.eq("form_type", formType);
    }
    if (status) {
      countQuery = countQuery.eq("status", status);
    }
    if (dateFrom) {
      countQuery = countQuery.gte("submitted_at", dateFrom);
    }
    if (dateTo) {
      countQuery = countQuery.lte("submitted_at", dateTo);
    }
    if (search) {
      const sanitized = search.replace(/%/g, "\\%").replace(/,/g, "\\,");
      countQuery = countQuery.or(
        `name.ilike.%${sanitized}%,company_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
      );
    }

    const { count } = await countQuery;

    const formsTotalPromise = adminSupabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true });
    const formsPendingPromise = adminSupabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .or("status.is.null,status.eq.pending");
    const formsRecentPromise = adminSupabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .gte(
        "submitted_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    const [formsTotalResult, formsPendingResult, formsRecentResult] =
      await Promise.all([
        formsTotalPromise,
        formsPendingPromise,
        formsRecentPromise,
      ]);

    const metrics = {
      overall: formsTotalResult.count || 0,
      pending: formsPendingResult.count || 0,
      last24Hours: formsRecentResult.count || 0,
    };

    const statusCounts: Record<string, number> = {
      pending: metrics.pending,
      processed: Math.max(0, metrics.overall - metrics.pending),
    };

    const { data: allFormTypeRows, error: typeError } = await adminSupabase
      .from("form_submissions")
      .select("form_type");

    if (typeError) {
      console.error("Failed to fetch form types:", typeError);
    }

    const formTypeList = Array.from(
      new Set(
        (allFormTypeRows || [])
          .map((item) => item.form_type)
          .filter((value): value is string => Boolean(value))
      )
    );

    const formTypeSummaries = await Promise.all(
      formTypeList.map(async (type) => {
        const [
          { count: totalForType },
          { count: pendingForType },
          { data: lastSubmitted },
        ] = await Promise.all([
          adminSupabase
            .from("form_submissions")
            .select("id", { count: "exact", head: true })
            .eq("form_type", type),
          adminSupabase
            .from("form_submissions")
            .select("id", { count: "exact", head: true })
            .eq("form_type", type)
            .or("status.is.null,status.eq.pending"),
          adminSupabase
            .from("form_submissions")
            .select("submitted_at")
            .eq("form_type", type)
            .order("submitted_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        return {
          formType: type,
          total: totalForType || 0,
          pending: pendingForType || 0,
          lastSubmittedAt: lastSubmitted?.submitted_at ?? null,
        };
      })
    );

    const rawSubmissions = (data ||
      []) as Database["public"]["Tables"]["form_submissions"]["Row"][];

    const submissions: FormSubmissionWithAssets[] = rawSubmissions.map(
      (submission) => {
        const images = imagesBySubmission.get(submission.id) ?? [];
        const thumbnail = images.find((img) => img.variant === "thumb");

        return {
          ...submission,
          images,
          attachmentsCount: images.length,
          thumbnailUrl: thumbnail?.public_url ?? null,
        };
      }
    );

    return NextResponse.json({
      success: true,
      submissions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      formTypes: formTypeList,
      statusCounts,
      metrics,
      typeBreakdown: formTypeSummaries,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// UPDATE form submission status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Check admin authentication
    const userResponse = await supabase.auth.getUser();
    const user = userResponse.data?.user;
    const authError = userResponse.error;
    if (authError || !user || typeof user.id !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const safeUser = user!;

    // Use service role for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify admin role
    const profileResponse = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", safeUser.id)
      .single();
    const profile = profileResponse.data!;
    if (
      !profile ||
      typeof profile.role !== "string" ||
      !["admin", "super_admin", "lister"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, reviewer_notes } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      );
    }

    // Use strict type for update
    const updateData: Partial<
      Database["public"]["Tables"]["form_submissions"]["Row"]
    > = {
      status,
      reviewed_at: new Date().toISOString(),
      ...(reviewer_notes ? { reviewer_notes } : {}),
    };

    const { data, error } = await supabase
      .from("form_submissions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
    }

    // Award XP for "suggest_place" if approved/processed
    // This connects the "Suggest New Place" activity
    const additionalData = data?.additional_data as Record<string, unknown> | null;
    const userId = typeof additionalData?.user_id === "string" ? additionalData.user_id : null;

    if (
      data &&
      (data.status === "approved" || data.status === "processed") &&
      data.form_type === "get-listed" &&
      userId // Only if we captured the user ID
    ) {
      try {
        const { awardXP } = await import("@/lib/gamification");
        await awardXP(userId, "suggest_place", data.id);
      } catch (xpError) {
        console.error("Failed to award XP for suggest_place:", xpError);
      }
    }

    // Award XP for "report_info" if approved/processed
    if (
      data &&
      (data.status === "approved" || data.status === "processed") &&
      (data.form_type === "listing_report" || data.form_type === "event_report") &&
      userId
    ) {
      try {
        const { awardXP } = await import("@/lib/gamification");
        // Use form ID as related ID
        await awardXP(userId, "report_info", data.id);
      } catch (xpError) {
        console.error("Failed to award XP for report_info:", xpError);
      }
    }

    return NextResponse.json({
      success: true,
      submission:
        data as Database["public"]["Tables"]["form_submissions"]["Row"],
      message: "Submission updated successfully",
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
