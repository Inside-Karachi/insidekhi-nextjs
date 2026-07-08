import { NextResponse } from "next/server";

import {
  createNotification,
  resolveCategorySlugForRole,
} from "@/lib/notifications";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  NotificationPriority,
  NotificationUserRole,
} from "@/types/notifications.types";
type ScenarioCopy = {
  title: string;
  body: string;
  priority: NotificationPriority;
  ctaLabel?: string;
  ctaUrl?: string;
};

const SCENARIO_COPY: Record<NotificationUserRole, ScenarioCopy> = {
  super_admin: {
    title: "System health check: nightly audit is complete",
    body: "Our automated health sweep just finished without any blockers. You can review the latest audit log snapshot for more detail.",
    priority: "high",
    ctaLabel: "View audit logs",
    ctaUrl: "/admin/logs",
  },
  admin: {
    title: "New Get Listed submission awaiting review",
    body: "A business owner just shared their listing details. Approve or request edits to keep the onboarding queue flowing.",
    priority: "normal",
    ctaLabel: "Open submission queue",
    ctaUrl: "/admin/forms",
  },
  lister: {
    title: "Fresh review posted on one of your listings",
    body: "A visitor left feedback on your Karachi listing. Jump in to thank them or address any concerns while it’s still fresh.",
    priority: "normal",
    ctaLabel: "Read latest reviews",
    ctaUrl: "/dashboard/reviews",
  },
  business_owner: {
    title: "New lead captured from your premium page",
    body: "Someone just requested more details from your listing. Follow up quickly to close the loop and keep momentum high.",
    priority: "normal",
    ctaLabel: "Open my leads",
    ctaUrl: "/dashboard/bookings",
  },
  writer: {
    title: "Story pitch approved—ready for publication",
    body: "Editorial gave the green light to your recent submission. Give it one last review before we feature it on Inside Karachi.",
    priority: "normal",
    ctaLabel: "Finalize my draft",
    ctaUrl: "/dashboard",
  },
  organizer: {
    title: "New ticket sold for your event!",
    body: "Someone just purchased a ticket for your upcoming event. Check your dashboard for the latest sales figures.",
    priority: "normal",
    ctaLabel: "View dashboard",
    ctaUrl: "/dashboard",
  },
  public_user: {
    title: "Your booking is confirmed—get ready for Karachi!",
    body: "We’ve locked in your spot. Keep this confirmation handy and check the event page for last-minute updates or perks.",
    priority: "low",
    ctaLabel: "View my bookings",
    ctaUrl: "/dashboard/bookings",
  },
};

export async function POST() {
  try {
    // Disable demo seeding in production environments
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const userSupabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = await createServerSupabase({ useServiceRole: true });
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const role = profile?.role ?? "public_user";
    const copy = SCENARIO_COPY[role];
    const categorySlug = await resolveCategorySlugForRole(adminSupabase, role);

    const nowIso = new Date().toISOString();

    const result = await createNotification(
      {
        recipientId: user.id,
        roleScope: role,
        categorySlug,
        title: copy.title,
        body: copy.body,
        metadata: {
          demo: true,
          generatedAt: nowIso,
          actorName: profile?.full_name ?? null,
        },
        priority: copy.priority,
        ctaLabel: copy.ctaLabel,
        ctaUrl: copy.ctaUrl,
        dedupeKey: `demo-${role}-${nowIso}`,
        validateRecipientRole: false,
      },
      { supabase: adminSupabase }
    );

    return NextResponse.json({
      success: true,
      notificationId: result.notification.id,
    });
  } catch (error) {
    console.error("POST /api/notifications/seed failed", error);
    return NextResponse.json(
      { error: "Failed to generate demo notification" },
      { status: 500 }
    );
  }
}
