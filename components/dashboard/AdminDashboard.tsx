import { createServerSupabase } from "@/lib/supabase/server";

// Role-based dashboard components
import { SuperAdminDashboard } from "./SuperAdminDashboard";
import { AdminDashboardClient } from "./AdminDashboardClient";
import { WriterDashboard } from "./WriterDashboard";
import { ListerDashboard } from "./ListerDashboard";

// Import centralized types
import type {
  Profile,
  DashboardStatistics,
  RecentActivity,
  GrowthMetrics,
} from "@/types/dashboard.types";
import type { FormsOverviewData } from "@/types/form.types";

interface AdminDashboardProps {
  user: {
    id: string;
    email?: string;
  };
  profile: Profile;
}

interface AdminDashboardData {
  statistics: DashboardStatistics;
  growth: GrowthMetrics;
  recentActivity: RecentActivity;
  forms?: FormsOverviewData;
}

async function getAdminDashboardData(): Promise<AdminDashboardData | null> {
  try {
    // Use service role client for admin operations to bypass RLS
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get comprehensive dashboard statistics using service role
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: totalEvents },
      { count: publishedEvents },
      { count: totalListings },
      { count: activeListings },
      { count: totalReviews },
      { count: pendingReviews },
      // Comment statistics
      { count: totalComments },
      { count: pendingComments },
      { count: approvedComments },
      { count: rejectedComments },
      { count: flaggedComments },
    ] = await Promise.all([
      // Total users
      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true }),

      // Active users (created in last 30 days)
      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        ),

      // Total events
      adminSupabase.from("events").select("*", { count: "exact", head: true }),

      // Published events
      adminSupabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),

      // Total listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true }),

      // Active listings
      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),

      // Total reviews
      adminSupabase.from("reviews").select("*", { count: "exact", head: true }),

      // Pending reviews
      adminSupabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),

      // Comment statistics
      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true }),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved"),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected"),

      adminSupabase
        .from("review_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "flagged"),
    ]);

    // Get recent activity using service role
    const { data: recentUsers } = await adminSupabase
      .from("profiles")
      .select("id, full_name, created_at, role, avatar_url")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentEvents } = await adminSupabase
      .from("events")
      .select("id, name, created_at, status")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentListings } = await adminSupabase
      .from("listings")
      .select("id, name, created_at, status")
      .order("created_at", { ascending: false })
      .limit(5);

    // Calculate growth metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      { count: usersThisMonth },
      { count: eventsThisMonth },
      { count: listingsThisMonth },
      { count: usersThisWeek },
      { count: eventsThisWeek },
      { count: listingsThisWeek },
    ] = await Promise.all([
      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),

      adminSupabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),

      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),

      adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),

      adminSupabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),

      adminSupabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),
    ]);

    let formsOverview: FormsOverviewData | undefined;

    try {
      const { data: formTypeRows } = await adminSupabase
        .from("form_submissions")
        .select("form_type");

      const formTypes = Array.from(
        new Set(
          (formTypeRows || [])
            .map((row) => row.form_type)
            .filter((type): type is string => Boolean(type))
        )
      );

      const [
        { count: formsTotal },
        { count: formsPending },
        { count: formsLast24Hours },
      ] = await Promise.all([
        adminSupabase
          .from("form_submissions")
          .select("id", { count: "exact", head: true }),
        adminSupabase
          .from("form_submissions")
          .select("id", { count: "exact", head: true })
          .or("status.is.null,status.eq.pending"),
        adminSupabase
          .from("form_submissions")
          .select("id", { count: "exact", head: true })
          .gte(
            "submitted_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          ),
      ]);

      const formTypeSummaries = await Promise.all(
        formTypes.map(async (formType) => {
          const [
            { count: totalForType },
            { count: pendingForType },
            { data: lastSubmitted },
          ] = await Promise.all([
            adminSupabase
              .from("form_submissions")
              .select("id", { count: "exact", head: true })
              .eq("form_type", formType),
            adminSupabase
              .from("form_submissions")
              .select("id", { count: "exact", head: true })
              .eq("form_type", formType)
              .or("status.is.null,status.eq.pending"),
            adminSupabase
              .from("form_submissions")
              .select("submitted_at")
              .eq("form_type", formType)
              .order("submitted_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          return {
            formType,
            total: totalForType || 0,
            pending: pendingForType || 0,
            lastSubmittedAt: lastSubmitted?.submitted_at ?? null,
          };
        })
      );

      const { data: latestFormSubmissions } = await adminSupabase
        .from("form_submissions")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(8);

      const attachmentsMap = new Map<
        number,
        { count: number; thumb: string | null }
      >();

      if (latestFormSubmissions && latestFormSubmissions.length > 0) {
        const submissionIds = latestFormSubmissions.map(
          (submission) => submission.id
        );

        if (submissionIds.length > 0) {
          const { data: attachmentRows } = await adminSupabase
            .from("form_submission_images")
            .select("submission_id, public_url, variant")
            .in("submission_id", submissionIds);

          if (attachmentRows) {
            for (const row of attachmentRows) {
              if (typeof row.submission_id !== "number") {
                continue;
              }

              const existing = attachmentsMap.get(row.submission_id) || {
                count: 0,
                thumb: null,
              };

              const nextCount = existing.count + 1;
              const nextThumb =
                existing.thumb ??
                (row.variant === "thumb" ? row.public_url ?? null : null);

              attachmentsMap.set(row.submission_id, {
                count: nextCount,
                thumb: nextThumb,
              });
            }
          }
        }
      }

      formsOverview = {
        totals: {
          overall: formsTotal || 0,
          pending: formsPending || 0,
          last24Hours: formsLast24Hours || 0,
        },
        byType: formTypeSummaries
          .filter(Boolean)
          .sort((a, b) => b.total - a.total),
        latest:
          latestFormSubmissions?.map((submission) => ({
            ...submission,
            attachmentsCount: attachmentsMap.get(submission.id)?.count ?? 0,
            thumbnailUrl: attachmentsMap.get(submission.id)?.thumb ?? null,
          })) ?? [],
      };
    } catch (formsError) {
      console.error("Error fetching forms overview:", formsError);
    }

    const dashboardData = {
      statistics: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalEvents: totalEvents || 0,
        publishedEvents: publishedEvents || 0,
        totalListings: totalListings || 0,
        activeListings: activeListings || 0,
        totalReviews: totalReviews || 0,
        pendingReviews: pendingReviews || 0,
        // Comment statistics
        totalComments: totalComments || 0,
        pendingComments: pendingComments || 0,
        approvedComments: approvedComments || 0,
        rejectedComments: rejectedComments || 0,
        flaggedComments: flaggedComments || 0,
      },
      growth: {
        usersThisMonth: usersThisMonth || 0,
        eventsThisMonth: eventsThisMonth || 0,
        listingsThisMonth: listingsThisMonth || 0,
        usersThisWeek: usersThisWeek || 0,
        eventsThisWeek: eventsThisWeek || 0,
        listingsThisWeek: listingsThisWeek || 0,
      },
      recentActivity: {
        users: recentUsers || [],
        events: recentEvents || [],
        listings: recentListings || [],
      },
      ...(formsOverview ? { forms: formsOverview } : {}),
    } satisfies AdminDashboardData;

    return dashboardData;
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    return null;
  }
}

export async function AdminDashboard({ user, profile }: AdminDashboardProps) {
  const dashboardData = await getAdminDashboardData();

  if (!dashboardData) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">
            Error Loading Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Unable to load dashboard data. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  // Role-based dashboard routing
  const userRole = profile?.role;

  switch (userRole) {
    case "super_admin":
      return (
        <SuperAdminDashboard
          user={user}
          profile={profile}
          dashboardData={dashboardData}
        />
      );
    case "admin":
      // Only pass serializable props to the client component
      return (
        <AdminDashboardClient
          user={{ id: user.id, email: user.email }}
          profile={profile}
          dashboardData={JSON.parse(JSON.stringify(dashboardData))}
        />
      );
    case "writer":
      return (
        <WriterDashboard
          user={user}
          profile={profile}
          dashboardData={dashboardData}
        />
      );
    case "lister":
      return (
        <ListerDashboard
          user={user}
          profile={profile}
          dashboardData={dashboardData}
        />
      );
    default:
      // Fallback for any other roles
      return (
        <AdminDashboardClient
          user={{ id: user.id, email: user.email }}
          profile={profile}
          dashboardData={JSON.parse(JSON.stringify(dashboardData))}
        />
      );
  }
}
