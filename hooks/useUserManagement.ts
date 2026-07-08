"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  membership_plan: string | null;
  phone: string | null;
  email_confirmed: boolean;
  last_sign_in: string | null;
  created_at: string;
  updated_at: string;
}

interface UseUserManagementReturn {
  updateUser: (userId: string, userData: Partial<User>) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  isLoading: boolean;
}

export function useUserManagement(): UseUserManagementReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const updateUser = async (
    userId: string,
    userData: Partial<User>
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update user");
      }

      toast({
        title: "Success",
        description: result.message || "User updated successfully",
      });

      return true;
    } catch (error) {
      console.error("Update user error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update user",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to delete user");
      }

      toast({
        title: "Success",
        description: result.message || "User deleted successfully",
      });

      return true;
    } catch (error) {
      console.error("Delete user error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateUser,
    deleteUser,
    isLoading,
  };
}
