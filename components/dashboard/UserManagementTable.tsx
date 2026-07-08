"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  User,
  Crown,
  PenTool,
  MapPin,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RecentUser } from "../../types/dashboard.types";
import { useAvatar } from "@/hooks/useAvatar";

// UserAvatar component that properly handles avatar URLs
function UserAvatar({ user }: { user: RecentUser }) {
  const { avatarUrl, isLoading: _isLoading } = useAvatar(
    user.id,
    user.avatar_url || null
  );

  return (
    <Avatar className="h-12 w-12">
      <AvatarImage src={avatarUrl || undefined} />
      <AvatarFallback>{user.full_name?.charAt(0) || "U"}</AvatarFallback>
    </Avatar>
  );
}

interface UserManagementTableProps {
  users: RecentUser[];
  isLoading?: boolean;
  onEditUser: (user: RecentUser) => void;
  onDeleteUser: (user: RecentUser) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function UserManagementTable({
  users,
  isLoading = false,
  onEditUser,
  onDeleteUser,
  searchQuery,
  onSearchChange,
  currentPage,
  totalPages,
  onPageChange,
}: UserManagementTableProps) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Crown className="h-4 w-4" />;
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "business_owner":
        return <Building className="h-4 w-4" />;
      case "writer":
        return <PenTool className="h-4 w-4" />;
      case "lister":
        return <MapPin className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "admin":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "business_owner":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "writer":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20";
      case "lister":
        return "bg-pink-500/10 text-pink-700 border-pink-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Search and Filters */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </motion.div>

      {/* Users Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-muted rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-6 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-24" />
              </CardContent>
            </Card>
          ))
        ) : users.length === 0 ? (
          // Empty state
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No users found</h3>
            <p className="text-muted-foreground text-center">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "No users match the current filters"}
            </p>
          </div>
        ) : (
          // User cards
          users.map((user) => (
            <motion.div key={user.id} variants={itemVariants}>
              <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {user.full_name || "Unnamed User"}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          ID: {user.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEditUser(user)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteUser(user)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "flex items-center gap-1",
                        getRoleColor(user.role)
                      )}
                    >
                      {getRoleIcon(user.role)}
                      {user.role.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Joined: {formatDate(user.created_at)}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between"
        >
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
