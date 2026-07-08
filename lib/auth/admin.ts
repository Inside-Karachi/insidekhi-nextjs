import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

type UserRole = Database["public"]["Enums"]["user_role"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface AdminAuthResult {
  user: {
    id: string;
    email?: string;
  };
  profile: Profile;
}

/** When middleware already validated the session, pass user to skip a second getUser(). */
export type MiddlewareAuthUser = {
  id: string;
  email?: string;
};

/**
 * Checks if a user role has admin privileges
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Checks if a user role has staff privileges (lister role)
 */
export function isStaffRole(role: UserRole): boolean {
  return role === "lister";
}

/**
 * Checks if a user role has super admin privileges
 */
export function isSuperAdminRole(role: UserRole): boolean {
  return role === "super_admin";
}

export function getAdminAuthErrorStatus(error: unknown): 401 | 403 | null {
  const message = error instanceof Error ? error.message : "";

  if (message === "Authentication required" || message === "Profile not found") {
    return 401;
  }

  if (
    message === "Admin access required" ||
    message === "Super admin access required"
  ) {
    return 403;
  }

  return null;
}

/**
 * Requires admin-level access for API routes
 * Throws error if user is not authenticated or doesn't have admin role
 */
export async function requireAdmin(
  _request: NextRequest,
  knownUser?: MiddlewareAuthUser,
): Promise<AdminAuthResult> {
  try {
    const supabase = await createServerSupabase();

    let userId: string;
    let userEmail: string | undefined;

    if (knownUser) {
      userId = knownUser.id;
      userEmail = knownUser.email;
    } else {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Authentication required");
      }
      userId = user.id;
      userEmail = user.email;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    // Check admin role
    if (!isAdminRole(profile.role)) {
      throw new Error("Admin access required");
    }

    return {
      user: {
        id: userId,
        email: userEmail,
      },
      profile,
    };
  } catch (error) {
    console.error("Admin authentication failed:", error);
    throw error;
  }
}

/**
 * Requires super admin-level access for sensitive operations
 * Throws error if user is not authenticated or doesn't have super admin role
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<AdminAuthResult> {
  try {
    const result = await requireAdmin(request);

    // Additional check for super admin role
    if (!isSuperAdminRole(result.profile.role)) {
      throw new Error("Super admin access required");
    }

    return result;
  } catch (_error) {
    console.error("Super admin authentication failed:", _error);
    throw _error;
  }
}

/**
 * Requires staff-level access for content management operations
 * Throws error if user is not authenticated or doesn't have staff/lister role
 */
export async function requireStaff(
  _request: NextRequest,
  knownUser?: MiddlewareAuthUser,
): Promise<AdminAuthResult> {
  try {
    const supabase = await createServerSupabase();

    let userId: string;
    let userEmail: string | undefined;

    if (knownUser) {
      userId = knownUser.id;
      userEmail = knownUser.email;
    } else {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Authentication required");
      }
      userId = user.id;
      userEmail = user.email;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    // Check staff role (lister) or admin role (admins have unrestricted access)
    if (!isStaffRole(profile.role) && !isAdminRole(profile.role)) {
      throw new Error("Staff access required");
    }

    return {
      user: {
        id: userId,
        email: userEmail,
      },
      profile,
    };
  } catch (error) {
    console.error("Staff authentication failed:", error);
    throw error;
  }
}

/**
 * Gets the current admin user if authenticated, returns null if not
 * Useful for conditional admin features
 */
export async function getCurrentAdmin(
  request: NextRequest
): Promise<AdminAuthResult | null> {
  try {
    return await requireAdmin(request);
  } catch {
    return null;
  }
}

/**
 * Gets the current staff user if authenticated, returns null if not
 * Useful for conditional staff features
 */
export async function getCurrentStaff(
  request: NextRequest
): Promise<AdminAuthResult | null> {
  try {
    return await requireStaff(request);
  } catch {
    return null;
  }
}

/**
 * Validates if the current user can perform an action on a specific resource
 * Useful for granular permissions
 */
export async function canAccessResource(
  request: NextRequest,
  resourceOwnerId?: string,
  requiredRole: UserRole = "admin"
): Promise<boolean> {
  try {
    // For admin-required resources, check admin access
    if (requiredRole === "admin" || requiredRole === "super_admin") {
      const { profile } = await requireAdmin(request);

      // Super admins can access everything
      if (isSuperAdminRole(profile.role)) {
        return true;
      }

      // Regular admins can access non-super-admin resources
      if (isAdminRole(profile.role) && requiredRole !== "super_admin") {
        return true;
      }
    }

    // For staff-required resources, check staff access
    if (requiredRole === "lister") {
      const { profile } = await requireStaff(request);
      return isStaffRole(profile.role);
    }

    // Check resource ownership for non-admin users
    if (resourceOwnerId) {
      const supabase = await createServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id === resourceOwnerId) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
