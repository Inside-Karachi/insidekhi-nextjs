"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { DeleteAccountDialog } from "@/components/dashboard/DeleteAccountDialog";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Calendar,
  Edit3,
  Camera,
  Save,
  X,
  Crown,
  Lock,
  User,
  ArrowLeft,
  RefreshCw,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

interface ProfileData {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  points?: number | null;
  created_at?: string | null;
  username?: string | null;
  phone?: string | null;
  membership_plan?: string | null;
  role?: string | null;
  organizer_bio?: string | null;
  organizer_company?: string | null;
  organizer_website?: string | null;
}

interface UserData {
  id: string;
  email?: string;
}

interface PremiumProfilePageProps {
  user: UserData;
  profile: ProfileData | null;
}

// Simple Avatar Component
interface SimpleAvatarProps {
  avatarUrl: string;
  displayName: string;
  userInitials: string;
  isEditing: boolean;
  isUploading: boolean;
  previewUrl: string | null;
  onAvatarUpload: (file: File) => void;
}

function SimpleAvatar({
  avatarUrl,
  displayName,
  userInitials,
  isEditing,
  isUploading,
  previewUrl,
  onAvatarUpload,
}: SimpleAvatarProps) {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAvatarUpload(file);
    }
  };

  return (
    <div className="relative group inline-block">
      <div
        className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-border relative transition-shadow duration-300 group-hover:shadow-premium ${
          isUploading ? "ring-4 ring-primary/30" : ""
        }`}
      >
        {previewUrl || avatarUrl ? (
          <Image
            src={previewUrl || avatarUrl}
            alt={`${displayName}'s profile picture`}
            width={80}
            height={80}
            className="w-full h-full object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
            <span className="text-lg md:text-xl font-bold text-primary">
              {userInitials}
            </span>
          </div>
        )}
        {/* Edit overlay (shows on hover when editing enabled) */}
        {isEditing && (
          <label
            className={`absolute inset-0 flex items-center justify-center bg-black/60 ${
              isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity duration-200 cursor-pointer rounded-full`}
          >
            {!isUploading ? (
              <>
                <Camera className="w-5 h-5 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
              </>
            ) : (
              // Uploading state: spinner in center
              <div className="flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </label>
        )}
      </div>
    </div>
  );
}

export function PremiumProfilePage({ user, profile }: PremiumProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  // uploadProgress removed (reserved for future enhancement)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const searchParams = useSearchParams();

  // Deep link from the public /delete-account page (and store-listing URL)
  // straight into the confirmation flow.
  React.useEffect(() => {
    if (searchParams.get("openDelete") === "1") {
      setShowDeleteDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form validation schema (Zod)
  const phoneRegex = /^(?:(?:\+92|0)?3\d{9})$/;

  const ProfileSchema = z
    .object({
      full_name: z.string().min(1, "Full name is required"),
      username: z.string().optional().nullable(),
      phone: z
        .string()
        .optional()
        .nullable()
        .refine(
          (val) => {
            if (!val) return true;
            // strip spaces, dashes
            const normalized = val.replace(/[\s-]/g, "");
            return phoneRegex.test(normalized);
          },
          {
            message:
              "Invalid mobile number format (e.g. 03XXXXXXXXX or +923XXXXXXXXX)",
          },
        ),
      avatar_url: z.string().url().optional().nullable(),
      membership_plan: z.string().optional().nullable(),
      // Organizer-specific fields
      organizer_bio: z.string().max(500).optional().nullable(),
      organizer_company: z.string().max(100).optional().nullable(),
      organizer_website: z
        .string()
        .url()
        .optional()
        .nullable()
        .or(z.literal("")),
      // Password-related fields (optional unless user intends to change)
      current_password: z.string().optional().nullable(),
      new_password: z
        .string()
        .optional()
        .nullable()
        .refine((v) => !v || v.length >= 8, {
          message: "New password must be at least 8 characters",
        }),
      confirm_password: z.string().optional().nullable(),
    })
    .superRefine((data, ctx) => {
      // If user is attempting to change password, enforce rules
      const changing = !!(
        data.new_password ||
        data.confirm_password ||
        data.current_password
      );
      if (changing) {
        if (!data.current_password) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["current_password"],
            message: "Current password is required to change your password",
          });
        }
        if (!data.new_password) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["new_password"],
            message: "New password is required",
          });
        }
        if (!data.confirm_password) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["confirm_password"],
            message: "Please confirm your new password",
          });
        }
        if (
          data.new_password &&
          data.confirm_password &&
          data.new_password !== data.confirm_password
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["confirm_password"],
            message: "Passwords do not match",
          });
        }
      }
    });

  type ProfileFormValues = z.infer<typeof ProfileSchema>;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      username: profile?.username || "",
      phone: profile?.phone || "",
      avatar_url: profile?.avatar_url || null,
      membership_plan: profile?.membership_plan || null,
      organizer_bio:
        (profile as ProfileData & { organizer_bio?: string | null })
          ?.organizer_bio || null,
      organizer_company:
        (profile as ProfileData & { organizer_company?: string | null })
          ?.organizer_company || null,
      organizer_website:
        (profile as ProfileData & { organizer_website?: string | null })
          ?.organizer_website || null,
    },
  });

  // Additional simple UI state copied from legacy form (we use toast for user feedback)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at)
    : new Date();
  const watchedFullName = watch("full_name");
  const displayName = watchedFullName || user.email?.split("@")[0] || "User";
  const userInitials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // update via react-hook-form's setValue when needed
  // form updates use react-hook-form's register/setValue directly

  // password strength is calculated inline where needed

  // Migrated: core form submit logic (from components/dashboard/ProfileForm.tsx)
  // onSubmit via react-hook-form
  const onSubmit = async (values: ProfileFormValues) => {
    setIsSaving(true);
    // If a password change is being attempted, call password API first
    if (values.new_password) {
      try {
        const pwRes = await fetch("/api/profile/password", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            currentPassword: values.current_password || "",
            newPassword: values.new_password,
          }),
        });

        if (!pwRes.ok) {
          const pd = await pwRes.json().catch(() => ({}));
          toast({
            title: "Error",
            description: pd?.error || "Failed to change password",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }

        // success for password
        toast({
          title: "Password updated",
          description: "Your password has been changed.",
        });
        setShowPasswordForm(false);
        // clear password fields in the form
        setValue("current_password", null);
        setValue("new_password", null);
        setValue("confirm_password", null);
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Unable to change password",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
    }
    try {
      const payload: Record<string, unknown> = {
        full_name: values.full_name.trim(),
        avatar_url: values.avatar_url || null,
      };
      if (values.username)
        payload.username = (values.username as string).trim();
      if (values.phone) payload.phone = (values.phone as string).trim();
      if (profile?.role === "business_owner" && values.membership_plan)
        payload.membership_plan = values.membership_plan;

      // Add organizer-specific fields if role is organizer
      if (profile?.role === "organizer") {
        if (values.organizer_bio !== undefined)
          payload.organizer_bio = values.organizer_bio?.trim() || null;
        if (values.organizer_company !== undefined)
          payload.organizer_company = values.organizer_company?.trim() || null;
        if (values.organizer_website !== undefined)
          payload.organizer_website = values.organizer_website?.trim() || null;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // If specific field validation error, set form error
        if (data?.field && data?.message) {
          try {
            setError(data.field as keyof ProfileFormValues, {
              type: "manual",
              message: data.message,
            });
          } catch (e) {
            // ignore if setError fails due to mismatch
            console.warn("setError failed:", e);
          }
        }
        toast({
          title: "Error",
          description: data?.message || data?.error || "Failed to save profile",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      setIsEditing(false);
      router.refresh();
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Avatar upload logic will be handled by the more feature-complete handler below.

  // Password change handler triggers main form validation via react-hook-form
  const handlePasswordChange = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // validate and submit via main onSubmit
    handleSubmit(onSubmit)();
  };

  // legacy handleSave removed; use handleSubmit instead

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select a valid image file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("avatar", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload avatar");
      }

      const data = await response.json();
      // set avatar_url into form
      setValue("avatar_url", data.publicUrl);

      setTimeout(() => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }, 1000);

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been successfully updated.",
      });
    } catch (error) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to upload avatar",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Simple Navigation */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 md:mb-8 mt-0"
      >
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
      </motion.div>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.45 }}
        className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
      >
        {/* Gradient overlay (visual only) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
          aria-hidden
        />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Simple Avatar */}
            <SimpleAvatar
              avatarUrl={(watch("avatar_url") as string) || ""}
              displayName={displayName}
              userInitials={userInitials}
              isEditing={isEditing}
              isUploading={isUploading}
              previewUrl={previewUrl}
              onAvatarUpload={handleAvatarUpload}
            />

            {/* Profile Info */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                  {displayName}
                </h1>
                {profile?.role === "business_owner" && (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    <Crown className="w-3 h-3 mr-1" />
                    Business
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1 text-muted-foreground text-sm">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Member since {memberSince.getFullYear()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? "outline" : "default"}
              size="sm"
            >
              {isEditing ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </>
              )}
            </Button>

            {isEditing && (
              <Button
                onClick={handleSubmit(onSubmit)}
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
      {/* Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.45 }}
        className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-6 md:mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-sm"
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
          aria-hidden
        />
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
              Personal{" "}
              <span className="gradient-text-primary">Information</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              Update your account details
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="full_name"
              {...register("full_name")}
              disabled={!isEditing}
              className="h-10 disabled:opacity-60"
              placeholder="Enter your full name"
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              Username
            </Label>
            <Input
              id="username"
              {...register("username")}
              disabled={!isEditing}
              className="h-10 disabled:opacity-60"
              placeholder="Choose a username"
            />
            {errors.username && (
              <p className="text-sm text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="h-10 bg-muted/50 opacity-60"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone Number
            </Label>
            <Input
              id="phone"
              {...register("phone", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const raw = e.target.value || "";
                  let sanitized = raw.replace(/[^0-9+]/g, "");
                  // enforce length caps for Pakistan mobile formats
                  let maxLen = 13; // default (covers +92...)
                  if (sanitized.startsWith("+")) {
                    maxLen = 13; // +923XXXXXXXXX
                  } else if (sanitized.startsWith("0")) {
                    maxLen = 11; // 03XXXXXXXXX
                  } else if (sanitized.startsWith("3")) {
                    maxLen = 10; // 3XXXXXXXXX
                  }
                  if (sanitized.length > maxLen)
                    sanitized = sanitized.slice(0, maxLen);
                  setValue("phone", sanitized, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                },
              })}
              disabled={!isEditing}
              className="h-10 disabled:opacity-60"
              placeholder="+92 300 1234567"
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          {/* Membership Plan (Business Owners Only) */}
          {profile?.role === "business_owner" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="membership_plan" className="text-sm font-medium">
                Membership Plan
              </Label>
              <Select
                value={watch("membership_plan") || undefined}
                onValueChange={(value) => setValue("membership_plan", value)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-10 disabled:opacity-60">
                  <SelectValue placeholder="Select membership plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic Plan</SelectItem>
                  <SelectItem value="premium">Premium Plan</SelectItem>
                  <SelectItem value="enterprise">Enterprise Plan</SelectItem>
                </SelectContent>
              </Select>
              {errors.membership_plan && (
                <p className="text-sm text-destructive">
                  {errors.membership_plan.message}
                </p>
              )}
            </div>
          )}

          {/* Organizer-Specific Fields */}
          {profile?.role === "organizer" && (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="organizer_company"
                  className="text-sm font-medium"
                >
                  Company/Organization Name
                </Label>
                <Input
                  id="organizer_company"
                  {...register("organizer_company")}
                  disabled={!isEditing}
                  className="h-10 disabled:opacity-60"
                  placeholder="Your company or organization name"
                  maxLength={100}
                />
                {errors.organizer_company && (
                  <p className="text-sm text-destructive">
                    {errors.organizer_company.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="organizer_website"
                  className="text-sm font-medium"
                >
                  Website URL
                </Label>
                <Input
                  id="organizer_website"
                  {...register("organizer_website")}
                  disabled={!isEditing}
                  className="h-10 disabled:opacity-60"
                  placeholder="https://yourwebsite.com"
                  type="url"
                />
                {errors.organizer_website && (
                  <p className="text-sm text-destructive">
                    {errors.organizer_website.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="organizer_bio" className="text-sm font-medium">
                  Bio/About
                </Label>
                <textarea
                  id="organizer_bio"
                  {...register("organizer_bio")}
                  disabled={!isEditing}
                  className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background disabled:opacity-60 disabled:cursor-not-allowed resize-y"
                  placeholder="Tell people about yourself and your events (max 500 characters)"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {watch("organizer_bio")?.length || 0}/500 characters
                </p>
                {errors.organizer_bio && (
                  <p className="text-sm text-destructive">
                    {errors.organizer_bio.message}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Security Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.45 }}
        className="relative overflow-hidden glass-card border border-border rounded-2xl p-8 shadow-sm mt-6"
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
          aria-hidden
        />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
              <span className="gradient-text-primary">Security</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              Manage your account security
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          variant="outline"
          className="w-full md:w-auto"
        >
          <Lock className="w-4 h-4 mr-2" />
          Change Password
        </Button>
        {showPasswordForm && (
          <form
            onSubmit={handlePasswordChange}
            className="mt-4 space-y-3 border-t border-border/20 pt-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Label className="text-sm font-medium">Current password</Label>
              </div>
              <div className="md:col-span-2">
                <div className="relative mt-2">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    {...register("current_password")}
                    className="w-full"
                    aria-label="Current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={
                      showCurrentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  {errors.current_password && (
                    <p className="text-sm text-destructive mt-2">
                      {errors.current_password.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Label className="text-sm font-medium">New password</Label>
              </div>
              <div className="md:col-span-2">
                <div className="relative mt-2">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    {...register("new_password")}
                    className="w-full"
                    aria-label="New password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={
                      showNewPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {/* Strength meter directly under New password input */}
                {watch("new_password") &&
                  (() => {
                    const pw = watch("new_password") || "";
                    const score = ((): number => {
                      let s = 0;
                      if (pw.length >= 8) s += 1;
                      if (/[0-9]/.test(pw)) s += 1;
                      if (/[A-Z]/.test(pw)) s += 1;
                      if (/[^A-Za-z0-9]/.test(pw)) s += 1;
                      return s;
                    })();
                    const label =
                      score >= 4
                        ? "Very strong"
                        : score === 3
                          ? "Strong"
                          : score === 2
                            ? "Medium"
                            : "Weak";
                    return (
                      <div className="mt-2">
                        <div className="h-2 w-full bg-muted/20 rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all duration-200 ${
                              score <= 1
                                ? "bg-red-500"
                                : score === 2
                                  ? "bg-amber-400"
                                  : score === 3
                                    ? "bg-green-400"
                                    : "bg-green-600"
                            }`}
                            style={{ width: `${(score / 4) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {label}
                        </p>
                        {errors.new_password && (
                          <p className="text-sm text-destructive">
                            {errors.new_password.message}
                          </p>
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Label className="text-sm font-medium">
                  Confirm new password
                </Label>
              </div>
              <div className="md:col-span-2">
                <div className="relative mt-2">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    {...register("confirm_password")}
                    className="w-full"
                    aria-label="Confirm new password"
                  />
                  {errors.confirm_password && (
                    <p className="text-sm text-destructive mt-2">
                      {errors.confirm_password.message}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(onSubmit)()}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-md bg-primary text-primary-foreground font-semibold shadow"
              >
                Update password
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  // clear password fields
                  setValue("current_password", null);
                  setValue("new_password", null);
                  setValue("confirm_password", null);
                }}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-md border"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.45 }}
        className="glass-card border border-destructive/30 rounded-2xl p-8 shadow-sm mt-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-destructive">
              Danger Zone
            </h2>
            <p className="text-muted-foreground text-sm">
              Permanently delete your account and personal information.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          className="w-full md:w-auto"
        >
          Delete Account
        </Button>
      </motion.div>

      <DeleteAccountDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      />

      {/* bottom spacer so form doesn't touch footer/newsletter */}
      <div className="h-24 md:h-40" aria-hidden />
    </>
  );
}
