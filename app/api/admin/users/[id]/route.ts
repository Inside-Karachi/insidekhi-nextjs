import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

// GET /api/admin/users/[id] - Get user by ID (for OrganizerSelect)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Use existing admin authentication utility
    await requireAdmin(request);
    const supabase = await createServerSupabase();
    const { id } = await params;

    // Get user profile using regular authenticated client with RLS
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .eq("id", id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Admin get user API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// PUT /api/admin/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    // Use existing admin authentication utility
    const adminAuth = await requireAdmin(request);

    const resolvedParams = await params;
    const userId = resolvedParams.id;
    const body = await request.json();

    // Validate input
    const allowedFields = [
      "full_name",
      "username",
      "email",
      "role",
      "active_role",
      "membership_plan",
      "phone",
    ];

    const updateData: Record<string, string | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Handle empty username by setting it to null to avoid unique constraint violations
        if (field === "username" && body[field] === "") {
          updateData[field] = null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Validate role if provided
    const validRoles = [
      "public_user",
      "business_owner",
      "writer",
      "lister",
      "organizer",
      "admin",
      "super_admin",
    ];
    if (updateData.role && !validRoles.includes(updateData.role)) {
      console.error(`[UPDATE USER] Invalid role: ${updateData.role}`);
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 },
      );
    }

    // active_role handling:
    // - super_admin: can set active_role to any valid value explicitly
    // - non-super_admin: active_role is always auto-synced from role; explicit overrides are stripped
    if (adminAuth.profile.role !== "super_admin") {
      // Strip any explicit active_role sent by the client - we'll sync it from role below
      delete updateData.active_role;
    } else {
      // super_admin explicit active_role validation
      if (
        updateData.active_role &&
        !validRoles.includes(updateData.active_role)
      ) {
        console.error(
          `[UPDATE USER] Invalid active_role: ${updateData.active_role}`,
        );
        return NextResponse.json(
          { success: false, error: "Invalid active_role" },
          { status: 400 },
        );
      }
    }

    // When role changes and no explicit active_role override is set, sync active_role = new role
    // This ensures the user's session reflects the new permanent role immediately
    if (updateData.role && !updateData.active_role) {
      updateData.active_role = updateData.role;
    }

    // Prevent regular admin from promoting users to admin/super_admin
    if (
      updateData.role &&
      (updateData.role === "admin" || updateData.role === "super_admin")
    ) {
      if (adminAuth.profile.role !== "super_admin") {
        console.error(
          `[UPDATE USER] Regular admin attempted to assign ${updateData.role} role`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient permissions to assign admin roles",
          },
          { status: 403 },
        );
      }
    }

    // Get service role client for validation and updates
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    // Validate username uniqueness if provided and not empty/null
    if (updateData.username && updateData.username !== null) {
      // Check username format
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(updateData.username)) {
        console.error(
          `[UPDATE USER] Invalid username format: ${updateData.username}`,
        );
        return NextResponse.json(
          {
            success: false,
            error:
              "Username must be 3-30 characters and contain only letters, numbers, and underscores",
          },
          { status: 400 },
        );
      }

      // Check if username is already taken by another user (exclude current user)
      const { data: existingUsername } = await serviceSupabase
        .from("profiles")
        .select("id")
        .ilike("username", updateData.username)
        .neq("id", userId)
        .single();

      if (existingUsername) {
        console.error(
          `[UPDATE USER] Username already taken: ${updateData.username}`,
        );
        return NextResponse.json(
          { success: false, error: "Username is already taken" },
          { status: 409 },
        );
      }
    }

    // Validate and handle email update if provided
    let emailChanged = false;
    let oldEmail: string | undefined;
    let newEmail: string | undefined;
    if (updateData.email) {
      newEmail = updateData.email;

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        console.error(`[UPDATE USER] Invalid email format: ${newEmail}`);
        return NextResponse.json(
          { success: false, error: "Invalid email format" },
          { status: 400 },
        );
      }

      // Check for disposable email domains
      const disposableDomains = await import("disposable-email-domains");
      const emailDomain = newEmail.split("@")[1]?.toLowerCase();
      if (emailDomain && disposableDomains.default.includes(emailDomain)) {
        console.error(
          `[UPDATE USER] Disposable email domain detected: ${emailDomain}`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Disposable email addresses are not allowed",
          },
          { status: 400 },
        );
      }

      // Get current user email from auth.users
      const { data: currentAuthUser, error: currentAuthError } =
        await serviceSupabase.auth.admin.getUserById(userId);

      if (currentAuthError || !currentAuthUser.user) {
        console.error(
          `[UPDATE USER] Failed to get current auth user`,
          currentAuthError,
        );
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 },
        );
      }

      oldEmail = currentAuthUser.user.email;

      // Check if email is actually changing
      if (newEmail !== oldEmail) {
        // Check if new email is already in use by another user
        const { data: existingUsers } =
          await serviceSupabase.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some(
          (u) => u.email === newEmail && u.id !== userId,
        );

        if (emailExists) {
          console.error(`[UPDATE USER] Email already in use: ${newEmail}`);
          return NextResponse.json(
            {
              success: false,
              error: "Email address is already in use by another user",
            },
            { status: 409 },
          );
        }

        emailChanged = true;
      } else {
        emailChanged = false;
      }

      // Always remove email from updateData since it's not stored in profiles table
      delete updateData.email;
    }

    // Get current user data before update for logging (use service role to bypass RLS)
    const { data: currentProfile, error: fetchError } = await serviceSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error(
        `[UPDATE USER] Error fetching current user data:`,
        fetchError,
      );
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    // Role escalation validation: Prevent regular admin from assigning super_admin/admin roles
    if (updateData.role) {
      const requestingAdmin = adminAuth.profile;

      // Only super_admin can assign super_admin role
      if (
        updateData.role === "super_admin" &&
        requestingAdmin.role !== "super_admin"
      ) {
        console.error(
          `[UPDATE USER] Regular admin attempted to assign super_admin role`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Only super_admin can assign super_admin role",
          },
          { status: 403 },
        );
      }

      // Only super_admin can assign admin role
      if (
        updateData.role === "admin" &&
        requestingAdmin.role !== "super_admin"
      ) {
        console.error(
          `[UPDATE USER] Regular admin attempted to assign admin role`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Only super_admin can assign admin role",
          },
          { status: 403 },
        );
      }

      // Prevent regular admin from modifying super_admin users
      if (
        currentProfile.role === "super_admin" &&
        requestingAdmin.role !== "super_admin"
      ) {
        console.error(
          `[UPDATE USER] Regular admin attempted to modify super_admin user`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Only super_admin can modify super_admin users",
          },
          { status: 403 },
        );
      }
    }

    // Use service role for admin profile updates to bypass RLS

    // Auto-sync active_role when role changes but active_role is not explicitly set.
    // This ensures the user's dashboard reflects their new role immediately.
    if (updateData.role && updateData.active_role === undefined) {
      updateData.active_role = updateData.role;
    }

    const { data: updatedProfile, error: updateError } = await serviceSupabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error(`[UPDATE USER] Database error:`, updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update user" },
        { status: 500 },
      );
    }

    // Update email in auth.users if it was changed
    if (emailChanged && newEmail) {
      const { error: emailUpdateError } =
        await serviceSupabase.auth.admin.updateUserById(userId, {
          email: newEmail,
        });

      if (emailUpdateError) {
        console.error(
          `[UPDATE USER] Failed to update email in auth.users:`,
          emailUpdateError,
        );
        // This is a critical error - profile updated but auth email didn't
        // Log the issue but don't fail the entire operation
        console.error(
          `[UPDATE USER] CRITICAL: Profile updated but auth email update failed. Manual intervention may be required.`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update user email. Please contact support.",
            details: emailUpdateError.message,
          },
          { status: 500 },
        );
      }
    }

    // Log the admin action
    try {
      const { logUserUpdate } = await import("@/lib/audit");
      await logUserUpdate(
        adminAuth.user.id,
        userId,
        currentProfile,
        updatedProfile,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
      );
    } catch (logError) {
      console.error(`[UPDATE USER] Failed to log user update:`, logError);
      // Don't fail the operation if logging fails
    }

    // Session invalidation: Force re-authentication on critical changes
    const roleChanged =
      updateData.role && currentProfile.role !== updateData.role;
    const shouldInvalidateSession = emailChanged || roleChanged;

    if (shouldInvalidateSession) {
      try {
        const { error: signOutError } =
          await serviceSupabase.auth.admin.signOut(
            userId,
            "local", // Sign out from this device only
          );

        if (signOutError) {
          console.error(
            `[UPDATE USER] Failed to invalidate user session:`,
            signOutError,
          );
          // Log but don't fail - session will expire naturally
        }
      } catch (sessionError) {
        console.error(
          `[UPDATE USER] Error during session invalidation:`,
          sessionError,
        );
        // Continue - don't fail the operation
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: shouldInvalidateSession
        ? "User updated successfully. User will be required to log in again."
        : "User updated successfully",
      session_invalidated: shouldInvalidateSession,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[UPDATE USER] Unexpected error after ${duration}ms:`, error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user using RPC function
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    // Use existing admin authentication utility
    const adminAuth = await requireAdmin(request);
    const supabase = await createServerSupabase();
    const adminServiceSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    const resolvedParams = await params;
    const userId = resolvedParams.id;

    // Get user data before deletion for logging
    const { data: userToDelete, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error(`[DELETE USER] Error fetching user data:`, fetchError);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    // Prevent regular admin from deleting admin/super_admin users
    if (userToDelete.role === "admin" || userToDelete.role === "super_admin") {
      if (adminAuth.profile.role !== "super_admin") {
        console.error(
          `[DELETE USER] Regular admin attempted to delete ${userToDelete.role}`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient permissions to delete admin users",
          },
          { status: 403 },
        );
      }
    }

    // Prevent self-deletion
    if (userId === adminAuth.user.id) {
      console.error(`[DELETE USER] User attempted to delete themselves`);
      return NextResponse.json(
        { success: false, error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    // Prevent deleting the last super_admin
    if (userToDelete.role === "super_admin") {
      const { count: superAdminCount, error: countError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "super_admin");

      if (countError) {
        console.error(`[DELETE USER] Error counting super_admins:`, countError);
        return NextResponse.json(
          { success: false, error: "Failed to verify super_admin count" },
          { status: 500 },
        );
      }

      if (superAdminCount !== null && superAdminCount <= 1) {
        console.error(
          `[DELETE USER] Prevented deletion of last super_admin (count: ${superAdminCount})`,
        );
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot delete the last super_admin. System must have at least one super_admin.",
          },
          { status: 403 },
        );
      }
    }

    // Use the RPC function to handle complete user deletion
    const { data: rpcResult, error: rpcError } = await adminServiceSupabase.rpc(
      "delete_user_completely",
      {
        user_uuid: userId,
        p_admin_id: adminAuth.user.id,
      },
    );

    if (rpcError) {
      console.error(`[DELETE USER] RPC function error:`, rpcError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to delete user: ${rpcError.message}`,
          details: rpcError,
        },
        { status: 500 },
      );
    }

    // Type guard to check if the RPC result has the expected structure
    const isValidRpcResult = (
      data: unknown,
    ): data is {
      success: boolean;
      error?: string;
      message?: string;
      user_id?: string;
      admin_id?: string;
    } => {
      return (
        typeof data === "object" &&
        data !== null &&
        typeof (data as Record<string, unknown>).success === "boolean"
      );
    };

    // Check if RPC result has the expected structure
    if (!rpcResult || !isValidRpcResult(rpcResult)) {
      console.error(
        `[DELETE USER] RPC function returned invalid result:`,
        rpcResult,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid response from user deletion service",
          details: rpcResult,
        },
        { status: 500 },
      );
    }

    // Now we can safely access the properties
    if (!rpcResult.success) {
      console.error(`[DELETE USER] RPC function returned failure:`, rpcResult);
      return NextResponse.json(
        {
          success: false,
          error: rpcResult.error || "User deletion failed",
          details: rpcResult,
        },
        { status: 500 },
      );
    }

    // Now handle the Supabase Auth user deletion separately
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Check if auth user exists
    const { data: authUser, error: getUserError } =
      await adminSupabase.auth.admin.getUserById(userId);

    if (getUserError) {
      // If auth user doesn't exist, that's actually fine - the profile deletion succeeded
    } else if (authUser) {
      // Sign out user from all sessions first
      try {
        await adminSupabase.auth.admin.signOut(userId);
      } catch {
        // Sign out failure is non-critical (might be expected)
      }

      // Attempt auth user deletion with retry
      let deleteAuthError;
      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await adminSupabase.auth.admin.deleteUser(userId);

          if (!result.error) {
            break;
          }

          deleteAuthError = result.error;

          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (attemptError) {
          console.error(
            `[DELETE USER] Unexpected error on attempt ${attempt}:`,
            attemptError,
          );
          deleteAuthError = attemptError as Error;
        }
      }

      if (deleteAuthError) {
        console.error(`[DELETE USER] Auth deletion failed:`, deleteAuthError);
        // Don't fail the entire operation if auth deletion fails
        // The profile and all related data have been successfully deleted
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
      details: {
        profile_deleted: true,
        related_data_cleaned: true,
        auth_user_handled: !rpcError,
        duration_ms: duration,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[DELETE USER] Unexpected error after ${duration}ms:`, error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
