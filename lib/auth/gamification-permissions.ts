import type { Database } from "@/types/database";

type UserRole = Database["public"]["Enums"]["user_role"] | null | undefined;

export function isGamificationOperatorRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

export function canManageGamificationSettings(role: UserRole): boolean {
  return role === "super_admin";
}

export function canModerateShares(role: UserRole): boolean {
  return isGamificationOperatorRole(role);
}

export function canAwardXpForTarget(
  actorRole: UserRole,
  actorUserId: string,
  targetUserId: string
): boolean {
  if (isGamificationOperatorRole(actorRole)) {
    return true;
  }

  return actorUserId === targetUserId;
}
