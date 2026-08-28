import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Database } from "@/types/database";

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
 * Checks if a user role is the limited listing data-entry role
 */
export function isDataEntryRole(role: UserRole): boolean {
  return role === "data_entry";
}

/**
 * Roles allowed to view/edit listing capacity fields
 */
export function canAccessListingCapacity(role: UserRole): boolean {
  return (
    isDataEntryRole(role) ||
    isStaffRole(role) ||
    isAdminRole(role)
  );
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
    message === "Super admin access required" ||
    message === "Listing capacity access required" ||
    message === "Staff access required"
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
  request: NextRequest,
  knownUser?: MiddlewareAuthUser,
): Promise<AdminAuthResult> {
  try {
    let userId: string;
    let userEmail: string | undefined;

    if (knownUser) {
      userId = knownUser.id;
      userEmail = knownUser.email;
    } else {
      const session = await getSession(request);
      if (!session) {
        throw new Error("Authentication required");
      }
      userId = session.userId;
      userEmail = session.email;
    }

    const { rows } = await query(
      "SELECT * FROM profiles WHERE id = $1 LIMIT 1",
      [userId]
    );
    const profile = rows[0] as Profile | undefined;

    if (!profile) {
      throw new Error("Profile not found");
    }

    // A self-deleted account keeps a valid JWT for up to 7 days (no
    // server-side revocation list) - without this, a deleted ex-admin would
    // keep admin powers until their token naturally expires.
    if (profile.deleted_at) {
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
  request: NextRequest,
  knownUser?: MiddlewareAuthUser,
): Promise<AdminAuthResult> {
  try {
    let userId: string;
    let userEmail: string | undefined;

    if (knownUser) {
      userId = knownUser.id;
      userEmail = knownUser.email;
    } else {
      const session = await getSession(request);
      if (!session) {
        throw new Error("Authentication required");
      }
      userId = session.userId;
      userEmail = session.email;
    }

    const { rows } = await query(
      "SELECT * FROM profiles WHERE id = $1 LIMIT 1",
      [userId]
    );
    const profile = rows[0] as Profile | undefined;

    if (!profile) {
      throw new Error("Profile not found");
    }

    if (profile.deleted_at) {
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
 * Requires access to listing capacity data-entry endpoints
 * Allows data_entry, lister, admin, and super_admin
 */
export async function requireListingCapacityAccess(
  request: NextRequest,
  knownUser?: MiddlewareAuthUser,
): Promise<AdminAuthResult> {
  try {
    let userId: string;
    let userEmail: string | undefined;

    if (knownUser) {
      userId = knownUser.id;
      userEmail = knownUser.email;
    } else {
      const session = await getSession(request);
      if (!session) {
        throw new Error("Authentication required");
      }
      userId = session.userId;
      userEmail = session.email;
    }

    const { rows } = await query(
      "SELECT * FROM profiles WHERE id = $1 LIMIT 1",
      [userId]
    );
    const profile = rows[0] as Profile | undefined;

    if (!profile) {
      throw new Error("Profile not found");
    }

    if (profile.deleted_at) {
      throw new Error("Profile not found");
    }

    if (!canAccessListingCapacity(profile.role)) {
      throw new Error("Listing capacity access required");
    }

    return {
      user: {
        id: userId,
        email: userEmail,
      },
      profile,
    };
  } catch (error) {
    console.error("Listing capacity authentication failed:", error);
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
      const session = await getSession(request);
      if (session && session.userId === resourceOwnerId) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
