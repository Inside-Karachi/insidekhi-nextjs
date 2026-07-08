import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const CONFIG_KEY = "scraper.worker_automation";

const WorkerAutomationSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["manual", "interval"]).default("manual"),
  intervalMinutes: z.number().min(15).max(1440).default(1440),
  syncDefaults: z.object({
    maxConcurrent: z.number().min(1).max(10).default(5),
    autoPublish: z.boolean().default(false),
    preserveManualEdits: z.boolean().default(true),
  }),
  canary: z.object({
    enabled: z.boolean().default(false),
    entityLimit: z.number().min(3).max(100).default(10),
    maxErrorRatePercent: z.number().min(1).max(100).default(40),
  }),
});

type WorkerAutomationConfig = z.infer<typeof WorkerAutomationSchema>;

const DEFAULT_CONFIG: WorkerAutomationConfig = {
  enabled: false,
  mode: "manual",
  intervalMinutes: 1440,
  syncDefaults: {
    maxConcurrent: 5,
    autoPublish: false,
    preserveManualEdits: true,
  },
  canary: {
    enabled: false,
    entityLimit: 10,
    maxErrorRatePercent: 40,
  },
};

async function assertSuperAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, status: 401, supabase, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return { ok: false as const, status: 403, supabase, user };
  }

  return { ok: true as const, status: 200, supabase, user };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status },
      );
    }

    const { data, error } = await auth.supabase
      .from("system_config")
      .select("config_value")
      .eq("config_key", CONFIG_KEY)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to load worker config" },
        { status: 500 },
      );
    }

    const raw = data?.config_value;
    const parsed = WorkerAutomationSchema.safeParse(raw);

    return NextResponse.json({
      config: parsed.success ? parsed.data : DEFAULT_CONFIG,
      source: parsed.success ? "system_config" : "default",
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { error: "Internal server error", message: e.message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status },
      );
    }

    const body = (await request.json()) as unknown;
    const parsed = WorkerAutomationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid config", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { error } = await auth.supabase.from("system_config").upsert(
      {
        config_key: CONFIG_KEY,
        config_value: parsed.data,
        config_type: "setting",
        description: "Listing scraper worker automation config",
        requires_restart: false,
        is_public: false,
        updated_by: auth.user.id,
      },
      { onConflict: "config_key" },
    );

    if (error) {
      return NextResponse.json(
        { error: "Failed to save config" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, config: parsed.data });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { error: "Internal server error", message: e.message },
      { status: 500 },
    );
  }
}
