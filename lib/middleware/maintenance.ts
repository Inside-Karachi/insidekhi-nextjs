import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  estimatedEnd: string | null;
}

const DEBUG_SUPER_ADMIN_CHECK =
  process.env.NEXT_PUBLIC_SUPER_ADMIN_DEBUG === "1";

/**
 * Check if maintenance mode is enabled
 * Returns maintenance configuration if enabled, null if disabled
 */
export async function checkMaintenanceMode(
  request: NextRequest
): Promise<MaintenanceStatus | null> {
  try {
    // Use service role key to bypass RLS for system_config table
    // This is safe because we're only reading public configuration
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {}, // No-op in middleware
          remove() {}, // No-op in middleware
        },
      }
    );

    // Fetch maintenance configuration
    const { data: configs, error } = await supabase
      .from("system_config")
      .select("config_key, config_value")
      .in("config_key", [
        "maintenance.enabled",
        "maintenance.message",
        "maintenance.estimated_end",
      ]);

    if (error || !configs) {
      console.error("[MAINTENANCE CHECK] Error fetching config:", error);
      return null; // Fail open - allow access if we can't check
    }

    // Parse configuration
    const enabledConfig = configs.find(
      (c) => c.config_key === "maintenance.enabled"
    );
    const messageConfig = configs.find(
      (c) => c.config_key === "maintenance.message"
    );
    const estimatedEndConfig = configs.find(
      (c) => c.config_key === "maintenance.estimated_end"
    );

    // JSONB boolean values can be actual booleans OR strings "true"/"false"
    // Handle both: true, false, "true", "false"
    const configValue = enabledConfig?.config_value;
    const enabled =
      configValue === true ||
      configValue === "true" ||
      (typeof configValue === "string" && configValue.toLowerCase() === "true");

    console.log(
      "[MAINTENANCE CHECK] Enabled:",
      enabled,
      "Config Value:",
      configValue,
      "Type:",
      typeof configValue
    );

    if (!enabled) {
      return null; // Maintenance mode is disabled
    }

    // Extract JSON values (config_value is JSONB, strings are stored with quotes)
    const messageValue = messageConfig?.config_value;
    const estimatedEndValue = estimatedEndConfig?.config_value;

    // Remove JSON string quotes if present
    const cleanMessage =
      typeof messageValue === "string"
        ? messageValue.replace(/^"|"$/g, "")
        : messageValue;

    const cleanEstimatedEnd =
      estimatedEndValue &&
      estimatedEndValue !== null &&
      estimatedEndValue !== "null"
        ? String(estimatedEndValue).replace(/^"|"$/g, "")
        : null;

    return {
      enabled: true,
      message:
        cleanMessage ||
        "We are performing scheduled maintenance. We'll be back shortly!",
      estimatedEnd: cleanEstimatedEnd,
    };
  } catch (error) {
    console.error("[MAINTENANCE CHECK] Unexpected error:", error);
    return null; // Fail open - allow access on error
  }
}

/**
 * Check if user is super admin (can bypass maintenance mode)
 * This function is critical for allowing super admins to access the site during maintenance
 */
export async function isSuperAdmin(
  request: NextRequest,
  knownUserId?: string,
): Promise<boolean> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    let userId = knownUserId;

    if (!userId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (DEBUG_SUPER_ADMIN_CHECK) {
          console.log(
            "[SUPER ADMIN CHECK] No authenticated user:",
            userError?.message,
          );
        }
        return false;
      }
      userId = user.id;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      if (DEBUG_SUPER_ADMIN_CHECK) {
        console.log(
          "[SUPER ADMIN CHECK] Failed to fetch profile:",
          profileError?.message
        );
      }
      return false;
    }

    const isSuperAdmin = profile.role === "super_admin";
    if (DEBUG_SUPER_ADMIN_CHECK) {
      console.log(
        `[SUPER ADMIN CHECK] User ${userId} - Role: ${profile.role} - Is Super Admin: ${isSuperAdmin}`,
      );
    }

    return isSuperAdmin;
  } catch (error) {
    console.error("[SUPER ADMIN CHECK] Unexpected error:", error);
    return false;
  }
}

/**
 * Paths that should always be accessible during maintenance
 */
const ALWAYS_ACCESSIBLE_PATHS = [
  "/api/admin/security/config", // Needed to disable maintenance mode
  "/_next", // Next.js internal
  "/favicon.ico",
  "/logo-white.png",
  "/api/auth", // Auth endpoints
];

export function shouldBypassMaintenance(pathname: string): boolean {
  return ALWAYS_ACCESSIBLE_PATHS.some((path) => pathname.startsWith(path));
}
