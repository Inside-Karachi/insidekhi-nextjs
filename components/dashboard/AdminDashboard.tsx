import { query } from "@/lib/db";

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

async function countRows(
  table: string,
  whereSql?: string,
  params?: unknown[],
): Promise<number> {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM ${table}${whereSql ? ` WHERE ${whereSql}` : ""}`,
    params,
  );
  return (rows[0]?.count as number) || 0;
}

async function getAdminDashboardData(): Promise<AdminDashboardData | null> {
  try {
    const thirtyDaysAgoIso = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Get comprehensive dashboard statistics
    const [
      totalUsers,
      activeUsers,
      totalEvents,
      publishedEvents,
      totalListings,
      activeListings,
      totalReviews,
      pendingReviews,
      // Comment statistics
      totalComments,
      pendingComments,
      approvedComments,
      rejectedComments,
      flaggedComments,
    ] = await Promise.all([
      // Total users
      countRows("profiles"),

      // Active users (created in last 30 days)
      countRows("profiles", "created_at >= $1", [thirtyDaysAgoIso]),

      // Total events
      countRows("events"),

      // Published events
      countRows("events", "status = $1", ["published"]),

      // Total listings
      countRows("listings"),

      // Active listings
      countRows("listings", "status = $1", ["published"]),

      // Total reviews
      countRows("reviews"),

      // Pending reviews
      countRows("reviews", "status = $1", ["pending"]),

      // Comment statistics
      countRows("review_comments"),
      countRows("review_comments", "status = $1", ["pending"]),
      countRows("review_comments", "status = $1", ["approved"]),
      countRows("review_comments", "status = $1", ["rejected"]),
      countRows("review_comments", "status = $1", ["flagged"]),
    ]);

    // Get recent activity
    const [
      { rows: recentUsers },
      { rows: recentEvents },
      { rows: recentListings },
    ] = await Promise.all([
      query(
        `SELECT id, full_name, created_at, role, avatar_url
         FROM profiles ORDER BY created_at DESC LIMIT 5`,
      ),
      query(
        `SELECT id, name, created_at, status
         FROM events ORDER BY created_at DESC LIMIT 5`,
      ),
      query(
        `SELECT id, name, created_at, status
         FROM listings ORDER BY created_at DESC LIMIT 5`,
      ),
    ]);

    // Calculate growth metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      usersThisMonth,
      eventsThisMonth,
      listingsThisMonth,
      usersThisWeek,
      eventsThisWeek,
      listingsThisWeek,
    ] = await Promise.all([
      countRows("profiles", "created_at >= $1", [thirtyDaysAgo.toISOString()]),
      countRows("events", "created_at >= $1", [thirtyDaysAgo.toISOString()]),
      countRows("listings", "created_at >= $1", [thirtyDaysAgo.toISOString()]),
      countRows("profiles", "created_at >= $1", [sevenDaysAgo.toISOString()]),
      countRows("events", "created_at >= $1", [sevenDaysAgo.toISOString()]),
      countRows("listings", "created_at >= $1", [sevenDaysAgo.toISOString()]),
    ]);

    let formsOverview: FormsOverviewData | undefined;

    try {
      const { rows: formTypeRows } = await query(
        `SELECT DISTINCT form_type FROM form_submissions`,
      );

      const formTypes = Array.from(
        new Set(
          formTypeRows
            .map((row) => row.form_type as string | null)
            .filter((type): type is string => Boolean(type))
        )
      );

      const [formsTotal, formsPending, formsLast24Hours] = await Promise.all([
        countRows("form_submissions"),
        countRows(
          "form_submissions",
          "(status IS NULL OR status = $1)",
          ["pending"],
        ),
        countRows("form_submissions", "submitted_at >= $1", [
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ]),
      ]);

      const formTypeSummaries = await Promise.all(
        formTypes.map(async (formType) => {
          const [totalForType, pendingForType, lastSubmittedResult] =
            await Promise.all([
              countRows("form_submissions", "form_type = $1", [formType]),
              countRows(
                "form_submissions",
                "form_type = $1 AND (status IS NULL OR status = $2)",
                [formType, "pending"],
              ),
              query(
                `SELECT submitted_at FROM form_submissions
                 WHERE form_type = $1
                 ORDER BY submitted_at DESC LIMIT 1`,
                [formType],
              ),
            ]);
          const lastSubmitted = lastSubmittedResult.rows[0];

          return {
            formType,
            total: totalForType || 0,
            pending: pendingForType || 0,
            lastSubmittedAt: lastSubmitted?.submitted_at ?? null,
          };
        })
      );

      const { rows: latestFormSubmissions } = await query(
        `SELECT * FROM form_submissions ORDER BY submitted_at DESC LIMIT 8`,
      );

      const attachmentsMap = new Map<
        number,
        { count: number; thumb: string | null }
      >();

      if (latestFormSubmissions && latestFormSubmissions.length > 0) {
        const submissionIds = latestFormSubmissions.map(
          (submission) => submission.id
        );

        if (submissionIds.length > 0) {
          const { rows: attachmentRows } = await query(
            `SELECT submission_id, public_url, variant
             FROM form_submission_images
             WHERE submission_id = ANY($1)`,
            [submissionIds],
          );

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
