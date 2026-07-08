import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { getAdminAnalyticsOverview } from "@/lib/analytics/admin";
import type { DateRangeFilter, DateRangePreset } from "@/types/analytics";

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAdmin(request);

    // Parse date range parameters
    const { searchParams } = request.nextUrl;
    const rangePreset = searchParams.get("range") as DateRangePreset | null;
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    // Build date range filter
    let dateRange: DateRangeFilter | undefined;
    if (rangePreset) {
      dateRange = {
        preset: rangePreset,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      };
    }

    const overview = await getAdminAnalyticsOverview({
      viewerRole: profile.role === "super_admin" ? "super_admin" : "admin",
      dateRange,
    });

    return NextResponse.json(
      { data: overview },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : "unknown";

    if (message.includes("authentication")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (message.includes("admin access")) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    console.error("Failed to load admin analytics overview", error);
    return NextResponse.json(
      { error: "Failed to load admin analytics overview" },
      { status: 500 }
    );
  }
}
