"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";



import * as Sentry from "@sentry/nextjs";
import type {
  UserRole,
  UserWithRoles,
  RoleSwitchResponse,
} from "@/types/auth.types";

interface RoleContextValue {
  user: UserWithRoles | null;
  isLoading: boolean;
  switchRole: (newRole: UserRole) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

function clearSentryUserContext() {
  Sentry.setUser(null);
  Sentry.setTag("user.role", "");
  Sentry.setTag("user.active_role", "");
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRoles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const getAvailableRoles = (permanentRole: UserRole): UserRole[] => {

    // Staff and business owners can toggle between their role and public_user
    if (
      permanentRole === "lister" ||
      permanentRole === "admin" ||
      permanentRole === "super_admin" ||
      permanentRole === "business_owner"
    ) {
      return [permanentRole, "public_user"];
    }

    // Non-staff cannot switch
    return [permanentRole];
  };

  const fetchUser = React.useCallback(async () => {
    try {
      const response = await fetch("/api/user/me");
      if (!response.ok) {
        clearSentryUserContext();
        setUser(null);
        return;
      }

      const data = await response.json();
      if (!data.user) {
        clearSentryUserContext();
        setUser(null);
        return;
      }

      const profile = data.user;
      const availableRoles = getAvailableRoles(profile.role);
      const canSwitch = availableRoles.length > 1;
      const activeRole = profile.active_role || profile.role;

      Sentry.setUser({ id: profile.id });
      Sentry.setTag("user.role", profile.role);
      Sentry.setTag("user.active_role", activeRole);

      setUser({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        active_role: activeRole,
        full_name: profile.full_name || undefined,
        avatar_url: profile.avatar_url || undefined,
        canSwitchRoles: canSwitch,
        availableRoles,
      });
    } catch (error) {
      console.error("[RoleContext] fetchUser error:", error);
      clearSentryUserContext();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchRole = async (newRole: UserRole): Promise<boolean> => {
    if (!user) return false;

    if (!user.availableRoles.includes(newRole)) {
      toast({
        title: "Invalid Role",
        description: "You don't have permission to switch to this role.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const response = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRole,
          ipAddress: null, // Could add IP detection
          userAgent: navigator.userAgent,
        }),
      });

      const data: RoleSwitchResponse = await response.json();

      if (!response.ok || !data.success) {
        toast({
          title: "Switch Failed",
          description: data.message || "Could not switch role",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setUser((prev) => (prev ? { ...prev, active_role: newRole } : null));

      toast({
        title: "Role Switched",
        description: `Now acting as ${newRole.replace("_", " ")}`,
      });

      // Refresh page to apply new permissions
      window.location.reload();

      return true;
    } catch (error) {
      console.error("Role switch error:", error);
      toast({
        title: "Error",
        description: "Failed to switch role",
        variant: "destructive",
      });
      return false;
    }
  };

  const refreshUser = async () => {
    setIsLoading(true);
    await fetchUser();
  };

  useEffect(() => {
    fetchUser();
    // Periodically fetch user or fetch on focus since we no longer listen to GoTrue web socket hooks
    const handleFocus = () => fetchUser();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchUser]);

  return (
    <RoleContext.Provider value={{ user, isLoading, switchRole, refreshUser }}>
      {children}
    </RoleContext.Provider>
  );
}


export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return context;
}

// Helper hooks
export function useActiveRole(): UserRole | null {
  const { user } = useRole();
  return user?.active_role || null;
}

export function useCanSwitchRoles(): boolean {
  const { user } = useRole();
  return user?.canSwitchRoles || false;
}

export function useIsStaff(): boolean {
  const { user } = useRole();
  if (!user) return false;
  return ["lister", "admin", "super_admin", "data_entry"].includes(user.role);
}
