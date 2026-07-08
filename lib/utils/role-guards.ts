import type { UserRole } from "@/types/auth.types";

/**
 * Server-side role utilities for middleware and API routes
 * These work with profile data fetched from database
 */

interface ProfileWithRole {
  role: UserRole;
  active_role?: UserRole;
}

export function getActiveRole(profile: ProfileWithRole | null): UserRole {
  if (!profile) return "public_user";
  return profile.active_role || profile.role;
}

export function hasAdminAccess(profile: ProfileWithRole | null): boolean {
  const active = getActiveRole(profile);
  return active === "admin" || active === "super_admin";
}

export function isSuperAdmin(profile: ProfileWithRole | null): boolean {
  const active = getActiveRole(profile);
  return active === "super_admin";
}

export function isStaff(profile: ProfileWithRole | null): boolean {
  const active = getActiveRole(profile);
  return active === "lister" || active === "admin" || active === "super_admin";
}

export function canAccessAdminRoute(
  profile: ProfileWithRole | null,
  pathname: string,
): boolean {
  const active = getActiveRole(profile);

  // Super admin backdoor: Always allow access to /admin routes
  // This ensures they can disable maintenance even in public mode
  if (profile?.role === "super_admin" && pathname.startsWith("/admin")) {
    return true;
  }

  // Regular admin access based on active role
  return active === "admin" || active === "super_admin";
}
