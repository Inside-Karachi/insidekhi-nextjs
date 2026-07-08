"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserFullManagementTable } from "@/components/admin/UserFullManagementTable";
import { UserManagementModal } from "@/components/dashboard/UserManagementModal";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Users,
  Shield,
  Building,
  Copy,
} from "lucide-react";

interface User {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  active_role?: string | null;
  membership_plan: string | null;
  phone: string | null;
  email_confirmed: boolean;
  last_sign_in: string | null;
  created_at: string;
  updated_at: string;
}

interface UserManagementPageProps {
  currentUserRole: string;
  adminVisibleRoles?: string[];
}

const ALL_ROLE_OPTIONS = [
  { value: "public_user", label: "Public User" },
  { value: "business_owner", label: "Business Owner" },
  { value: "writer", label: "Writer" },
  { value: "lister", label: "Lister" },
  { value: "organizer", label: "Organizer" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export function UserManagementPage({
  currentUserRole,
  adminVisibleRoles = ["writer", "lister", "organizer"],
}: UserManagementPageProps) {
  const [users, setUsers] = React.useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = React.useState<User[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [createdUserPassword, setCreatedUserPassword] = React.useState<
    string | null
  >(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
  const [isRegeneratingPassword, setIsRegeneratingPassword] =
    React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = React.useState(false);

  const {
    updateUser,
    deleteUser,
    isLoading: isActionLoading,
  } = useUserManagement();
  const { toast } = useToast();

  // Auto-copy password when dialog opens with password
  React.useEffect(() => {
    if (isPasswordDialogOpen && createdUserPassword) {
      navigator.clipboard
        .writeText(createdUserPassword)
        .then(() => {
          toast({
            title: "Password Copied!",
            description: "Temporary password has been copied to your clipboard",
          });
        })
        .catch(() => {
          toast({
            title: "Copy Failed",
            description: "Please manually copy the password",
            variant: "destructive",
          });
        });
    }
  }, [isPasswordDialogOpen, createdUserPassword, toast]);

  // Pagination
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage]);

  // Fetch users - load all pages if pagination required
  const fetchUsers = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/users");
      const result = await response.json();

      if (result.success) {
        let allUsers = result.data.users || [];

        // If there are multiple pages, fetch all remaining pages
        if (result.data.pagination && result.data.pagination.totalPages > 1) {
          for (
            let page = 2;
            page <= result.data.pagination.totalPages;
            page++
          ) {
            const pageResponse = await fetch(`/api/admin/users?page=${page}`);
            const pageResult = await pageResponse.json();

            if (pageResult.success && pageResult.data.users) {
              allUsers = [...allUsers, ...pageResult.data.users];
            }
          }
        }

        setUsers(allUsers);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("[USER MGMT] Fetch users error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Filter users
  React.useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.username?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Load users on mount only - no polling needed for admin pages
  React.useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = () => {
    setSelectedUser(null); // Clear selected user for create mode
    setIsModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (
      !confirm(
        `Are you sure you want to delete ${
          user.full_name || user.email
        }? This action cannot be undone.`,
      )
    ) {
      return;
    }

    const success = await deleteUser(user.id);
    if (success) {
      fetchUsers();
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const toggleBulkMode = () => {
    setIsBulkMode((prev) => !prev);
    // When exiting bulk mode, clear any selection
    if (isBulkMode) {
      clearSelection();
    }
  };

  const handleBulkDelete = async () => {
    if (!isBulkMode || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !confirm(
        `Delete ${count} selected user${
          count > 1 ? "s" : ""
        }? This cannot be undone.`,
      )
    )
      return;

    try {
      const res = await fetch("/api/admin/users/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Bulk delete failed");
      }
      toast({
        title: "Bulk Delete Complete",
        description: `Deleted: ${data.deletedCount}, Failed: ${data.failedCount}`,
      });
      clearSelection();
      fetchUsers();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast({
        title: "Bulk Delete Failed",
        description:
          error instanceof Error ? error.message : "Could not delete users",
        variant: "destructive",
      });
    }
  };

  // Generate a secure random password
  const generatePassword = () => {
    const length = 16;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleRegeneratePassword = () => {
    setIsRegeneratingPassword(true);
    const newPassword = generatePassword();
    setCreatedUserPassword(newPassword);

    // Copy the new password to clipboard
    navigator.clipboard
      .writeText(newPassword)
      .then(() => {
        toast({
          title: "Password Regenerated!",
          description: "New password has been copied to your clipboard",
        });
        setIsRegeneratingPassword(false);
      })
      .catch(() => {
        toast({
          title: "Password Regenerated",
          description: "Please manually copy the new password",
          variant: "destructive",
        });
        setIsRegeneratingPassword(false);
      });
  };

  const handleSaveUser = async (userData: Partial<User>) => {
    try {
      if (selectedUser) {
        // Edit existing user
        const success = await updateUser(selectedUser.id, userData);
        if (success) {
          setIsModalOpen(false);
          setSelectedUser(null);
          fetchUsers();
          toast({
            title: "Success",
            description: "User updated successfully",
          });
        }
      } else {
        // Create new user
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        });

        const result = await response.json();

        if (result.success) {
          setIsModalOpen(false);
          fetchUsers();

          // Show password dialog if it was generated for new user
          if (result.data.tempPassword) {
            setCreatedUserPassword(result.data.tempPassword);
            setIsPasswordDialogOpen(true);
          } else {
            toast({
              title: "Success",
              description: "User created successfully",
            });
          }
        } else {
          throw new Error(result.error);
        }
      }
    } catch (error) {
      console.error("Save user error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save user",
        variant: "destructive",
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const getUserStats = () => {
    return {
      total: users.length,
      admins: users.filter(
        (u) => u.role === "admin" || u.role === "super_admin",
      ).length,
      businessOwners: users.filter((u) => u.role === "business_owner").length,
      listers: users.filter((u) => u.role === "lister").length,
      verified: users.filter((u) => u.email_confirmed).length,
      active: users.filter((u) => {
        if (!u.last_sign_in) return false;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return new Date(u.last_sign_in) > thirtyDaysAgo;
      }).length,
    };
  };

  const stats = getUserStats();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-6 gap-4"
      >
        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-slate-500/5 dark:from-slate-500/10 dark:via-slate-500/5 dark:to-slate-500/0 border-slate-500/30 dark:border-slate-500/20 hover:shadow-xl hover:shadow-slate-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                Total Users
              </CardTitle>
              <div className="p-2 bg-slate-500/10 rounded-lg group-hover:bg-slate-500/20 transition-colors">
                <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">
                {stats.total}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors">
                Admins
              </CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {stats.admins}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20 hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors">
                Business Owners
              </CardTitle>
              <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <Building className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                {stats.businessOwners}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-teal-500/20 via-teal-500/10 to-teal-500/5 dark:from-teal-500/10 dark:via-teal-500/5 dark:to-teal-500/0 border-teal-500/30 dark:border-teal-500/20 hover:shadow-xl hover:shadow-teal-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-teal-900 dark:text-teal-100 group-hover:text-teal-800 dark:group-hover:text-teal-200 transition-colors">
                Listers
              </CardTitle>
              <div className="p-2 bg-teal-500/10 rounded-lg group-hover:bg-teal-500/20 transition-colors">
                <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {stats.listers}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/10 dark:via-emerald-500/5 dark:to-emerald-500/0 border-emerald-500/30 dark:border-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-200 transition-colors">
                Verified
              </CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {stats.verified}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-purple-500/0 border-purple-500/30 dark:border-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200 transition-colors">
                Active (30d)
              </CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {stats.active}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters and Actions */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 bg-primary/10 rounded-md">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <Input
                id="users-search"
                name="users-search"
                autoComplete="off"
                placeholder="Search users by name, email, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            {/* Role Filter */}
            <Select
              name="role-filter"
              value={roleFilter}
              onValueChange={setRoleFilter}
            >
              <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ALL_ROLE_OPTIONS.filter((r) => {
                  if (currentUserRole === "super_admin") return true;
                  return (
                    r.value === "public_user" ||
                    adminVisibleRoles.includes(r.value)
                  );
                }).map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              name="status-filter"
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="active">Active (30d)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            {currentUserRole === "super_admin" && (
              <Button
                variant={isBulkMode ? "default" : "outline"}
                onClick={toggleBulkMode}
                className={`h-11 px-6 ${
                  isBulkMode
                    ? "bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:shadow-primary/25"
                    : "bg-background/50 border-border/50 hover:bg-background/80"
                }`}
                title={isBulkMode ? "Exit bulk mode" : "Enter bulk mode"}
              >
                {isBulkMode ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                  </svg>
                )}
                {isBulkMode ? "Exit Bulk" : "Bulk"}
              </Button>
            )}
            <Button
              onClick={fetchUsers}
              variant="outline"
              className="h-11 px-6 border-border/50 hover:border-primary/50 hover:bg-primary/5"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            <Button
              className="h-11 px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={handleAddUser}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Bulk Actions */}
      {currentUserRole === "super_admin" &&
        isBulkMode &&
        selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm border border-primary/30 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span className="text-sm font-medium text-primary">
                    {selectedIds.size} user(s) selected
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="h-8 bg-background/50 border-border/50 hover:bg-background/80"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="h-8"
                >
                  Delete Selected ({selectedIds.size})
                </Button>
              </div>
            </div>
          </motion.div>
        )}

      {/* User Table */}
      <motion.div variants={itemVariants}>
        <UserFullManagementTable
          users={paginatedUsers}
          isLoading={isLoading}
          onEditUser={handleEditUser}
          onDeleteUser={handleDeleteUser}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          enableSelection={currentUserRole === "super_admin" && isBulkMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      </motion.div>

      {/* Edit User Modal */}
      <UserManagementModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUser}
        isLoading={isActionLoading}
        currentUserRole={currentUserRole}
        adminVisibleRoles={adminVisibleRoles}
        mode={selectedUser ? "edit" : "create"}
      />

      {/* Password Display Dialog */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              User Created Successfully
            </DialogTitle>
            <DialogDescription>
              A new user account has been created. The temporary password has
              been automatically copied to your clipboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Warning Banner */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
              <div className="p-1 bg-amber-500/20 rounded">
                <svg
                  className="h-5 w-5 text-amber-600 dark:text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  ⚠️ Critical: Save This Password Now!
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                  This password will NOT be shown again after you close this
                  dialog. Make sure to save it somewhere safe or share it with
                  the user immediately.
                </p>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Temporary Password
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="temporary-password"
                  name="temporary-password"
                  autoComplete="off"
                  value={createdUserPassword || ""}
                  readOnly
                  className="font-mono text-sm select-all"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (createdUserPassword) {
                      navigator.clipboard.writeText(createdUserPassword);
                      toast({
                        title: "Copied Again!",
                        description: "Password copied to clipboard",
                      });
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">
                Security Guidelines:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Share this password securely with the user via encrypted
                  channel
                </li>
                <li>
                  Instruct the user to change their password immediately after
                  first login
                </li>
                <li>
                  This password will be permanently hidden after closing this
                  dialog
                </li>
                <li>Do not share passwords via unsecured email or messaging</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleRegeneratePassword}
              disabled={isRegeneratingPassword}
              className="border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  isRegeneratingPassword ? "animate-spin" : ""
                }`}
              />
              Regenerate Password
            </Button>
            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  if (createdUserPassword) {
                    navigator.clipboard.writeText(createdUserPassword);
                    toast({
                      title: "Copied!",
                      description: "Password copied to clipboard one more time",
                    });
                  }
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Again
              </Button>
              <Button
                onClick={() => {
                  setIsPasswordDialogOpen(false);
                  setCreatedUserPassword(null);
                }}
                className="bg-gradient-to-r from-primary to-primary/90"
              >
                I Have Saved The Password
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
