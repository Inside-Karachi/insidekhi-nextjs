"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  User,
  Crown,
  PenTool,
  MapPin,
  Building,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvatar } from "@/hooks/useAvatar";

// UserAvatar component that properly handles avatar URLs
function UserAvatar({ user }: { user: User }) {
  const { avatarUrl } = useAvatar(user.id, user.avatar_url || null);

  return (
    <Avatar className="h-14 w-14 ring-2 ring-background/50 dark:ring-background/30 group-hover:ring-primary/30 dark:group-hover:ring-primary/40 transition-all duration-300">
      <AvatarImage src={avatarUrl || undefined} />
      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/10 dark:to-primary/5 text-primary font-semibold text-lg">
        {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
      </AvatarFallback>
    </Avatar>
  );
}

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
  deleted_at: string | null;
}

interface UserFullManagementTableProps {
  users: User[];
  isLoading?: boolean;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Bulk selection (optional)
  enableSelection?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, checked: boolean) => void;
}

export function UserFullManagementTable({
  users,
  isLoading = false,
  onEditUser,
  onDeleteUser,
  currentPage,
  totalPages,
  onPageChange,
  enableSelection = false,
  selectedIds,
  onToggleSelect,
}: UserFullManagementTableProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState<
    Record<string, boolean>
  >({});

  // Prevent scroll lock when dropdown opens
  React.useEffect(() => {
    const hasOpenDropdown = Object.values(dropdownOpen).some(
      (isOpen) => isOpen,
    );

    if (hasOpenDropdown) {
      // Remove any scroll-lock attributes that Radix might add
      const body = document.body;
      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      // Remove immediately and set up observer to catch any future additions
      removeScrollLock();

      const observer = new MutationObserver(() => {
        if (body.hasAttribute("data-scroll-locked")) {
          removeScrollLock();
        }
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
      });

      return () => {
        observer.disconnect();
        removeScrollLock();
      };
    }
  }, [dropdownOpen]);
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
      case "data_entry":
        return <MapPin className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "from-purple-500/20 via-purple-500/15 to-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 dark:border-purple-500/40 bg-gradient-to-r";
      case "admin":
        return "from-blue-500/20 via-blue-500/15 to-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 dark:border-blue-500/40 bg-gradient-to-r";
      case "business_owner":
        return "from-green-500/20 via-green-500/15 to-green-500/10 text-green-700 dark:text-green-300 border-green-500/30 dark:border-green-500/40 bg-gradient-to-r";
      case "writer":
        return "from-orange-500/20 via-orange-500/15 to-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30 dark:border-orange-500/40 bg-gradient-to-r";
      case "lister":
        return "from-teal-500/20 via-teal-500/15 to-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 dark:border-teal-500/40 bg-gradient-to-r";
      case "data_entry":
        return "from-amber-500/20 via-amber-500/15 to-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/40 bg-gradient-to-r";
      default:
        return "from-gray-500/20 via-gray-500/15 to-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30 dark:border-gray-500/40 bg-gradient-to-r";
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
      className="space-y-6 min-h-[600px]"
    >
      {/* Users Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-start"
      >
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-muted rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="h-6 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-4 bg-muted rounded w-28" />
                <div className="h-4 bg-muted rounded w-20" />
              </CardContent>
            </Card>
          ))
        ) : users.length === 0 ? (
          // Empty state
          <div className="col-span-full flex flex-col items-center justify-center py-12 min-h-[600px]">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No users found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No users match the current filters. Try adjusting your search
              criteria.
            </p>
          </div>
        ) : (
          // User cards
          users.map((user) => (
            <motion.div
              key={user.id}
              variants={itemVariants}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Card className="group relative overflow-hidden flex flex-col h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300">
                {enableSelection && (
                  <div className="absolute top-2 left-2 z-20">
                    <input
                      type="checkbox"
                      aria-label="Select user"
                      className="h-4 w-4 accent-primary"
                      checked={selectedIds?.has(user.id) || false}
                      onChange={(e) =>
                        onToggleSelect?.(user.id, e.currentTarget.checked)
                      }
                    />
                  </div>
                )}
                {/* Subtle hover background - optimized for less blur */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <CardHeader className="pb-4 relative z-10 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative">
                        <UserAvatar user={user} />
                        {/* Status indicator */}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center ring-2 ring-background">
                          {user.email_confirmed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate text-foreground group-hover:text-primary transition-colors duration-300 flex items-center gap-2">
                          <span className="truncate">
                            {user.full_name || user.username || "Unnamed User"}
                          </span>
                          {user.deleted_at && (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-xs px-1.5 py-0 border-destructive/30 text-destructive bg-destructive/10"
                            >
                              Deleted
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate group-hover:text-muted-foreground/80 transition-colors duration-300">
                          {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu
                      open={dropdownOpen[user.id] || false}
                      onOpenChange={(open) =>
                        setDropdownOpen((prev) => ({
                          ...prev,
                          [user.id]: open,
                        }))
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary/10 hover:text-primary relative z-10"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-48 bg-background/95 backdrop-blur-md shadow-premium border-border/60 rounded-xl"
                        align="end"
                        sideOffset={4}
                        alignOffset={-4}
                      >
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/2 rounded-xl pointer-events-none" />

                        <div className="relative z-10 p-2">
                          <DropdownMenuItem
                            onClick={() => onEditUser(user)}
                            className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteUser(user)}
                            className="cursor-pointer text-red-600 focus:text-red-600 hover:bg-red-500/10 focus:bg-red-500/10 transition-colors duration-200"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 relative z-10">
                  {/* Role and Membership Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "flex items-center gap-1.5 font-medium border shadow-sm hover:shadow-md transition-all duration-300 text-xs px-2 py-1",
                            getRoleColor(user.role),
                          )}
                        >
                          {getRoleIcon(user.role)}
                          <span className="capitalize">
                            {user.role.replace("_", " ")}
                          </span>
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-gradient-to-r from-muted/50 to-muted/30 border-border/30 hover:from-muted/60 hover:to-muted/40 transition-all duration-300 text-xs px-2 py-1"
                        >
                          {user.membership_plan || "Free"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3 flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted/50 rounded-md">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {user.email_confirmed ? "Verified" : "Unverified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted/50 rounded-md">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          ID: {user.id.slice(-8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Activity Timeline */}
                  <div className="pt-3 border-t border-border/30">
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-primary/10 rounded-md">
                            <Calendar className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Last Sign In
                          </span>
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {user.last_sign_in
                            ? formatDate(user.last_sign_in)
                            : "Never"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-green-500/10 rounded-md">
                            <User className="h-3 w-3 text-green-600" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Joined
                          </span>
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {formatDate(user.created_at)}
                        </span>
                      </div>
                    </div>
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
