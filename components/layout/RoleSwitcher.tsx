"use client";

import React from "react";
import { Shield, User } from "lucide-react";
import { motion } from "framer-motion";
import { useRole } from "@/lib/context/RoleContext";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/types/auth.types";

interface RoleSwitcherProps {
  onSwitched?: () => void;
}

export function RoleSwitcher({ onSwitched }: RoleSwitcherProps) {
  const { user, switchRole } = useRole();
  const { toast } = useToast();
  const [isSwitching, setIsSwitching] = React.useState(false);

  if (!user?.canSwitchRoles) {
    return null; // Don't show if user can't switch
  }

  const isStaffMode = user.active_role !== "public_user";

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      const targetRole: UserRole = isStaffMode ? "public_user" : user.role;
      await switchRole(targetRole);
      onSwitched?.();
    } catch (error) {
      console.error("Role switch error:", error);
      toast({
        title: "Switch Failed",
        description: "Could not switch roles. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <motion.button
      onClick={handleSwitch}
      disabled={isSwitching}
      whileHover={{ x: 2 }}
      className="group flex items-center justify-between w-full p-3 rounded-xl hover:bg-primary/10 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center space-x-3">
        {isStaffMode ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Shield className="h-4 w-4 text-primary" />
        )}
        <div className="text-left">
          <p className="text-sm font-medium text-foreground">
            {isSwitching
              ? "Switching..."
              : isStaffMode
                ? "Switch to Personal"
                : "Switch to Staff"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isStaffMode
              ? "Act as regular user"
              : `Back to ${user.role.replace("_", " ")}`}
          </p>
        </div>
      </div>
      <div
        className={`px-2 py-1 rounded-md text-xs font-medium ${isStaffMode
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground"
          }`}
      >
        {isStaffMode ? "Staff" : "Personal"}
      </div>
    </motion.button>
  );
}
