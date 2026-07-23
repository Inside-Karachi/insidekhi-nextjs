"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crown,
  Shield,
  User,
  Building,
  PenTool,
  MapPin,
  Star,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvatar } from "@/hooks/useAvatar";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";

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

interface UserManagementModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Partial<User>) => void;
  isLoading?: boolean;
  currentUserRole?: string;
  mode?: "create" | "edit";
  adminVisibleRoles?: string[];
}

export function UserManagementModal({
  user,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  currentUserRole = "admin",
  mode = "edit",
  adminVisibleRoles = ["writer", "lister", "organizer", "data_entry"],
}: UserManagementModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<Partial<User>>({
    full_name: "",
    username: "",
    email: "",
    role: "public_user",
    active_role: "public_user",
    membership_plan: "free",
    phone: "",
  });

  // Validation states
  const [usernameValidation, setUsernameValidation] = React.useState<{
    isChecking: boolean;
    isAvailable: boolean | null;
    message: string;
  }>({ isChecking: false, isAvailable: null, message: "" });

  const [emailValidation, setEmailValidation] = React.useState<{
    isChecking: boolean;
    isAvailable: boolean | null;
    message: string;
  }>({ isChecking: false, isAvailable: null, message: "" });

  // Password reset states
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = React.useState(false);

  const isEditMode = mode === "edit" && !!user;

  // Debounce username and email for validation
  const debouncedUsername = useDebounce(formData.username || "", 500);
  const debouncedEmail = useDebounce(formData.email || "", 500);

  // Password generation function
  const generatePassword = (length: number = 16): string => {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = lowercase + uppercase + numbers + special;

    let password = "";
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (!user) return;

    setIsResettingPassword(true);
    try {
      const generatedPassword = generatePassword(16);

      const response = await fetch(
        `/api/admin/users/${user.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: generatedPassword }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to reset password");
      }

      // Set the new password and show dialog
      setNewPassword(generatedPassword);
      setShowPasswordDialog(true);

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(generatedPassword);

      toast({
        title: "Password Reset Successfully",
        description: "New password has been copied to clipboard",
      });
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: "Password Reset Failed",
        description: "Failed to reset user password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Use avatar hook for proper signed URL handling (only in edit mode)
  const { avatarUrl, isLoading: isAvatarLoading } = useAvatar(
    user?.id || "",
    user?.avatar_url || null,
  );

  // Real-time username validation
  React.useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername || debouncedUsername.trim() === "") {
        setUsernameValidation({
          isChecking: false,
          isAvailable: null,
          message: "",
        });
        return;
      }

      // Skip validation if username hasn't changed in edit mode
      if (isEditMode && debouncedUsername === user?.username) {
        setUsernameValidation({
          isChecking: false,
          isAvailable: true,
          message: "Current username",
        });
        return;
      }

      setUsernameValidation({
        isChecking: true,
        isAvailable: null,
        message: "Checking...",
      });

      try {
        const params = new URLSearchParams({ username: debouncedUsername });
        if (isEditMode && user?.id) {
          params.append("excludeUserId", user.id);
        }

        const response = await fetch(
          `/api/admin/users/check-username?${params}`,
        );
        const data = await response.json();

        setUsernameValidation({
          isChecking: false,
          isAvailable: data.available,
          message: data.message || "",
        });
      } catch (_error) {
        setUsernameValidation({
          isChecking: false,
          isAvailable: null,
          message: "Failed to check username",
        });
      }
    };

    checkUsername();
  }, [debouncedUsername, isEditMode, user?.id, user?.username]);

  // Real-time email validation
  React.useEffect(() => {
    const checkEmail = async () => {
      if (!debouncedEmail || debouncedEmail.trim() === "") {
        setEmailValidation({
          isChecking: false,
          isAvailable: null,
          message: "",
        });
        return;
      }

      // Skip validation if email hasn't changed in edit mode
      if (isEditMode && debouncedEmail === user?.email) {
        setEmailValidation({
          isChecking: false,
          isAvailable: true,
          message: "Current email",
        });
        return;
      }

      setEmailValidation({
        isChecking: true,
        isAvailable: null,
        message: "Checking...",
      });

      try {
        const params = new URLSearchParams({ email: debouncedEmail });
        if (isEditMode && user?.id) {
          params.append("excludeUserId", user.id);
        }

        const response = await fetch(`/api/admin/users/check-email?${params}`);
        const data = await response.json();

        setEmailValidation({
          isChecking: false,
          isAvailable: data.available && data.valid,
          message: data.message || "",
        });
      } catch (_error) {
        setEmailValidation({
          isChecking: false,
          isAvailable: null,
          message: "Failed to check email",
        });
      }
    };

    checkEmail();
  }, [debouncedEmail, isEditMode, user?.id, user?.email]);

  // Update form data when user changes or mode changes or when modal opens
  React.useEffect(() => {
    if (isEditMode && user) {
      setFormData({
        full_name: user.full_name || "",
        username: user.username || "",
        email: user.email || "",
        role: user.role,
        active_role: user.active_role || user.role,
        membership_plan: user.membership_plan || "free",
        phone: user.phone || "",
      });
    } else if (mode === "create") {
      setFormData({
        full_name: "",
        username: "",
        email: "",
        role: "public_user",
        active_role: "public_user",
        membership_plan: "free",
        phone: "",
      });
      // Reset validation states for create mode
      setUsernameValidation({
        isChecking: false,
        isAvailable: null,
        message: "",
      });
      setEmailValidation({ isChecking: false, isAvailable: null, message: "" });
    }
  }, [user, mode, isEditMode, isOpen]);

  const handleSave = () => {
    if (isEditMode && !user) return;
    onSave(formData);
  };

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
        return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "admin":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "business_owner":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "writer":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20";
      case "lister":
        return "bg-pink-500/10 text-pink-700 border-pink-500/20";
      case "data_entry":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const canEditRole = (targetRole: string) => {
    if (currentUserRole === "super_admin") return true;
    if (currentUserRole === "admin" && targetRole !== "super_admin")
      return true;
    return false;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-gradient-to-br from-background via-background to-background/95 backdrop-blur-xl border border-border/50 shadow-2xl">
          <DialogHeader className="flex-shrink-0 pb-6 border-b border-border/50 bg-gradient-to-r from-background/30 to-background/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg" />
                  <div className="relative p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                </motion.div>
                <div className="space-y-1">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {isEditMode ? "Edit User Profile" : "Create New User"}
                    </DialogTitle>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <DialogDescription className="text-muted-foreground">
                      {isEditMode
                        ? "Update user information, permissions, and account settings"
                        : "Create a new user account with specified role and permissions"}
                    </DialogDescription>
                  </motion.div>
                </div>
              </div>

              {/* Status Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-green-700">
                    Active
                  </span>
                </div>
              </motion.div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-8"
            >
              {/* User info display - Only show in edit mode */}
              {isEditMode && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-sm border border-border/50 shadow-lg"
                >
                  {/* Background pattern */}
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(-45deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:16px_16px]" />

                  {/* Geometric Elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/3 rounded-full blur-xl" />

                  <div className="relative z-10 p-6">
                    <div className="flex items-start gap-4">
                      {/* Avatar section */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full blur-lg scale-110" />
                        <Avatar className="relative h-20 w-20 ring-2 ring-primary/20 shadow-xl">
                          {isAvatarLoading ? (
                            <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                              ...
                            </AvatarFallback>
                          ) : (
                            <>
                              <AvatarImage src={avatarUrl || undefined} />
                              <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                                {user?.full_name?.charAt(0) ||
                                  user?.email?.charAt(0) ||
                                  "U"}
                              </AvatarFallback>
                            </>
                          )}
                        </Avatar>
                        {/* Online Status Indicator */}
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-background shadow-lg">
                          <div className="w-full h-full bg-green-400 rounded-full animate-pulse" />
                        </div>
                      </div>

                      {/* User Details Section */}
                      <div className="flex-1 min-w-0">
                        <div className="space-y-3">
                          {/* Name and Email */}
                          <div>
                            <h3 className="text-xl font-bold text-foreground truncate">
                              {user.full_name || "Unnamed User"}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {user.email}
                            </p>
                          </div>

                          {/* Badges section */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Role Badge */}
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                                "bg-gradient-to-r border shadow-sm",
                                getRoleColor(user.role),
                              )}
                            >
                              {getRoleIcon(user.role)}
                              <span className="capitalize">
                                {user.role.replace("_", " ")}
                              </span>
                            </motion.div>

                            {/* Membership Badge */}
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 border border-amber-500/20 shadow-sm"
                            >
                              <Star className="h-3 w-3" />
                              <span className="capitalize">
                                {user.membership_plan || "Free"}
                              </span>
                            </motion.div>

                            {/* Email Verification Badge */}
                            {user.email_confirmed ? (
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-700 border border-green-500/20 shadow-sm"
                              >
                                <Shield className="h-3 w-3" />
                                <span>Verified</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-red-500/10 to-pink-500/10 text-red-700 border border-red-500/20 shadow-sm"
                              >
                                <Shield className="h-3 w-3" />
                                <span>Unverified</span>
                              </motion.div>
                            )}
                          </div>

                          {/* Additional Info */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Joined{" "}
                                {new Date(user.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {user.last_sign_in && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  Last active{" "}
                                  {new Date(
                                    user.last_sign_in,
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Form fields */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="space-y-6"
              >
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Personal Information
                    </h4>
                  </div>

                  {/* Full Name Field - Full Width */}
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-sm font-medium">
                      Full Name
                    </Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      autoComplete="off"
                      value={formData.full_name || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          full_name: e.target.value,
                        }))
                      }
                      placeholder="Enter full name"
                      className="h-11"
                    />
                  </div>

                  {/* Email Field - Full Width */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email Address *
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="off"
                        value={formData.email || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="Enter email address"
                        className={cn(
                          "h-11 pr-10",
                          emailValidation.isAvailable === true &&
                            "border-green-500 focus:border-green-500",
                          emailValidation.isAvailable === false &&
                            "border-red-500 focus:border-red-500",
                        )}
                        required
                      />
                      {/* Validation Icon */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailValidation.isChecking ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : emailValidation.isAvailable === true ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : emailValidation.isAvailable === false ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : null}
                      </div>
                    </div>
                    {/* Validation Message */}
                    {emailValidation.message && (
                      <p
                        className={cn(
                          "text-xs",
                          emailValidation.isAvailable
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {emailValidation.message}
                      </p>
                    )}
                  </div>

                  {/* Username and Phone in Same Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Username Field */}
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-medium">
                        Username
                      </Label>
                      <div className="relative">
                        <Input
                          id="username"
                          name="username"
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={formData.username || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              username: e.target.value,
                            }))
                          }
                          placeholder="Enter username"
                          className={cn(
                            "h-11 pr-10",
                            usernameValidation.isAvailable === true &&
                              "border-green-500 focus:border-green-500",
                            usernameValidation.isAvailable === false &&
                              "border-red-500 focus:border-red-500",
                          )}
                        />
                        {/* Validation Icon */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {usernameValidation.isChecking ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : usernameValidation.isAvailable === true ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : usernameValidation.isAvailable === false ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : null}
                        </div>
                      </div>
                      {/* Validation Message */}
                      {usernameValidation.message && (
                        <p
                          className={cn(
                            "text-xs",
                            usernameValidation.isAvailable
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400",
                          )}
                        >
                          {usernameValidation.message}
                        </p>
                      )}
                    </div>

                    {/* Phone Field */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        autoComplete="off"
                        value={formData.phone || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="Enter phone number"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Settings Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Account Settings
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Role Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-medium">
                        User Role
                      </Label>
                      <Select
                        name="role"
                        value={formData.role}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, role: value }))
                        }
                        disabled={!canEditRole(formData.role || "")}
                      >
                        <SelectTrigger id="role" className="h-11">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public_user">
                            Public User
                          </SelectItem>
                          {[
                            {
                              value: "business_owner",
                              label: "Business Owner",
                            },
                            { value: "writer", label: "Writer" },
                            { value: "lister", label: "Lister" },
                            { value: "data_entry", label: "Data Entry" },
                            { value: "organizer", label: "Event Organizer" },
                            { value: "admin", label: "Admin" },
                            { value: "super_admin", label: "Super Admin" },
                          ]
                            .filter(({ value }) => {
                              if (currentUserRole === "super_admin")
                                return true;
                              return adminVisibleRoles.includes(value);
                            })
                            .map(({ value, label }) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {!canEditRole(formData.role || "") && (
                        <p className="text-xs text-muted-foreground">
                          Insufficient permissions to change this role
                        </p>
                      )}
                    </div>

                    {/* Active Role Override - super_admin only, edit mode only */}
                    {currentUserRole === "super_admin" && isEditMode && (
                      <div className="space-y-2 md:col-span-2">
                        <Label
                          htmlFor="active_role"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <Shield className="h-3.5 w-3.5 text-purple-500" />
                          Active Role Override
                          <span className="text-xs text-purple-500 font-normal">
                            (Super Admin only)
                          </span>
                        </Label>
                        <Select
                          name="active_role"
                          value={
                            formData.active_role ||
                            formData.role ||
                            "public_user"
                          }
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              active_role: value,
                            }))
                          }
                        >
                          <SelectTrigger
                            id="active_role"
                            className="h-11 border-purple-500/30 focus:ring-purple-500/20"
                          >
                            <SelectValue placeholder="Select active role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public_user">
                              Public User
                            </SelectItem>
                            <SelectItem value="business_owner">
                              Business Owner
                            </SelectItem>
                            <SelectItem value="writer">Writer</SelectItem>
                            <SelectItem value="lister">Lister</SelectItem>
                            <SelectItem value="data_entry">
                              Data Entry
                            </SelectItem>
                            <SelectItem value="organizer">
                              Event Organizer
                            </SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">
                              Super Admin
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Overrides what role the user is currently acting as.
                          Use to fix users stuck on public_user.
                        </p>
                      </div>
                    )}

                    {/* Membership Selection */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="membership"
                        className="text-sm font-medium"
                      >
                        Membership Plan
                      </Label>
                      <Select
                        name="membership_plan"
                        value={formData.membership_plan || "free"}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            membership_plan: value,
                          }))
                        }
                      >
                        <SelectTrigger id="membership" className="h-11">
                          <SelectValue placeholder="Select membership" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Password Reset Section - Only in Edit Mode */}
                  {isEditMode && (
                    <div className="mt-6 pt-6 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h5 className="text-sm font-medium text-foreground">
                            Password Management
                          </h5>
                          <p className="text-xs text-muted-foreground">
                            Generate a new password for this user
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResetPassword}
                          disabled={isResettingPassword}
                          className="gap-2"
                        >
                          {isResettingPassword ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Resetting...
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4" />
                              Reset Password
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </div>

          <DialogFooter className="flex-shrink-0 gap-3 pt-6 border-t border-border/50 bg-gradient-to-r from-background/50 to-background/30">
            <div className="flex items-center justify-between w-full">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="text-xs text-muted-foreground"
              >
                Changes will be saved immediately
              </motion.div>
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-6 py-2 border-border/50 hover:border-border hover:bg-muted/50 transition-all duration-200"
                  >
                    Cancel
                  </Button>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  <Button
                    onClick={handleSave}
                    disabled={
                      isLoading ||
                      usernameValidation.isChecking ||
                      emailValidation.isChecking ||
                      !!(
                        formData.username &&
                        usernameValidation.isAvailable === false
                      ) ||
                      !!(
                        formData.email && emailValidation.isAvailable === false
                      )
                    }
                    className="px-6 py-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 min-w-[140px]"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </div>
                    ) : usernameValidation.isChecking ||
                      emailValidation.isChecking ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Validating...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Save Changes</span>
                      </div>
                    )}
                  </Button>
                </motion.div>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Password Reset Successful
            </DialogTitle>
            <DialogDescription>
              The new password has been generated and copied to your clipboard.
              Please share it with the user securely.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                New Temporary Password
              </Label>
              <div className="relative">
                <Input
                  id="new_temp_password"
                  name="new_temp_password"
                  autoComplete="off"
                  value={newPassword || ""}
                  readOnly
                  className="font-mono text-sm pr-20 bg-muted"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (newPassword) {
                      await navigator.clipboard.writeText(newPassword);
                      toast({
                        title: "Copied!",
                        description: "Password copied to clipboard again",
                      });
                    }
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3"
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> Make sure to save this password. The
                user will need to use this to log in. For security reasons, this
                password will not be shown again.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowPasswordDialog(false);
                setNewPassword(null);
              }}
              className="w-full"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
