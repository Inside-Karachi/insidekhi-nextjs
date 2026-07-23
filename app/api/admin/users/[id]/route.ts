import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";

// GET /api/admin/users/[id] - Get user by ID (for OrganizerSelect)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Use existing admin authentication utility
    await requireAdmin(request);
    const { id } = await params;

    const { rows } = await query(
      `SELECT p.id, p.full_name, u.email, p.avatar_url, p.role
       FROM public.profiles p
       LEFT JOIN auth.users u ON u.id = p.id
       WHERE p.id = $1
       LIMIT 1`,
      [id],
    );
    const profile = rows[0];

    if (!profile) {
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

    // Get current user data up front - needed both for logging and for
    // validating role/active_role combinations below.
    const { rows: currentProfileRows } = await query(
      `SELECT * FROM public.profiles WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const currentProfile = currentProfileRows[0];

    if (!currentProfile) {
      console.error(`[UPDATE USER] User not found: ${userId}`);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

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
      "data_entry",
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

    // active_role handling. This must mirror the DB's validate_active_role
    // trigger exactly (see profiles table), which enforces:
    // - "staff" roles (lister, admin, super_admin, business_owner) may have
    //   active_role be either themselves or 'public_user'
    // - every other role (writer, organizer, public_user) must have
    //   active_role === role, with no override allowed
    // Getting this wrong doesn't just produce a bad value - the trigger
    // rejects the whole UPDATE, so the effective role (new if provided,
    // else the user's current one) decides what's actually allowed here.
    const STAFF_SWITCHABLE_ROLES = new Set([
      "lister",
      "admin",
      "super_admin",
      "business_owner",
    ]);
    const effectiveRole = updateData.role || currentProfile.role;

    if (adminAuth.profile.role !== "super_admin") {
      // Strip any explicit active_role sent by the client - we'll sync it from role below
      delete updateData.active_role;
    } else if (!STAFF_SWITCHABLE_ROLES.has(effectiveRole)) {
      // Only one valid active_role exists for this role - correct it
      // automatically rather than rejecting the save over what's usually
      // just a stale form value from before "Role" was changed, not a
      // deliberate override attempt (only staff-switchable roles support
      // a genuine override, handled below).
      updateData.active_role = effectiveRole;
    } else if (
      updateData.active_role &&
      !["public_user", effectiveRole].includes(updateData.active_role)
    ) {
      console.error(
        `[UPDATE USER] Invalid active_role ${updateData.active_role} for role ${effectiveRole}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: `Active role must be "${effectiveRole}" or "public_user" for this role.`,
        },
        { status: 400 },
      );
    }

    // When role changes and no explicit active_role override is set, sync active_role = new role
    // This ensures the user's dashboard reflects the new permanent role immediately
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
      const { rows: existingUsernameRows } = await query(
        `SELECT id FROM public.profiles WHERE username ILIKE $1 AND id != $2 LIMIT 1`,
        [updateData.username, userId],
      );

      if (existingUsernameRows.length > 0) {
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
      const { rows: currentAuthRows } = await query(
        `SELECT email FROM auth.users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const currentAuthUser = currentAuthRows[0];

      if (!currentAuthUser) {
        console.error(`[UPDATE USER] Auth user not found for id ${userId}`);
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 },
        );
      }

      const oldEmail = currentAuthUser.email;

      // Check if email is actually changing
      if (newEmail !== oldEmail) {
        // Check if new email is already in use by another user
        const { rows: existingEmailRows } = await query(
          `SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1`,
          [newEmail, userId],
        );

        if (existingEmailRows.length > 0) {
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

    // Auto-sync active_role when role changes but active_role is not explicitly set.
    // This ensures the user's dashboard reflects their new role immediately.
    if (updateData.role && updateData.active_role === undefined) {
      updateData.active_role = updateData.role;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updateData)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
    values.push(userId);

    let updatedProfile;
    try {
      const { rows } = await query(
        `UPDATE public.profiles SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        values,
      );
      updatedProfile = rows[0];
    } catch (updateError) {
      console.error(`[UPDATE USER] Database error:`, updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update user" },
        { status: 500 },
      );
    }

    // Update email in auth.users if it was changed
    if (emailChanged && newEmail) {
      try {
        await query(`UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2`, [
          newEmail,
          userId,
        ]);
      } catch (emailUpdateError) {
        console.error(
          `[UPDATE USER] Failed to update email in auth.users:`,
          emailUpdateError,
        );
        // This is a critical error - profile updated but auth email didn't
        console.error(
          `[UPDATE USER] CRITICAL: Profile updated but auth email update failed. Manual intervention may be required.`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update user email. Please contact support.",
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

    // NOTE: sessions here are stateless JWTs with no server-side revocation list,
    // so unlike the old Supabase-backed flow, there is currently no way to force
    // an existing session to expire early after an email/role change. The
    // response reflects that honestly rather than claiming a session was
    // invalidated when it wasn't.
    const roleChanged =
      updateData.role && currentProfile.role !== updateData.role;
    const sensitiveChange = emailChanged || roleChanged;

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: sensitiveChange
        ? "User updated successfully. Note: their existing session remains valid until it expires naturally (up to 7 days) - there is currently no way to force it to expire immediately."
        : "User updated successfully",
      session_invalidated: false,
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

// DELETE /api/admin/users/[id] - Delete user completely (profile, related data, and auth.users row)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    // Use existing admin authentication utility
    const adminAuth = await requireAdmin(request);

    const resolvedParams = await params;
    const userId = resolvedParams.id;

    // Get user data before deletion for logging
    const { rows: userRows } = await query(
      `SELECT * FROM public.profiles WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const userToDelete = userRows[0];

    if (!userToDelete) {
      console.error(`[DELETE USER] User not found: ${userId}`);
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
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM public.profiles WHERE role = 'super_admin'`,
      );
      const superAdminCount = countRows[0]?.count ?? 0;

      if (superAdminCount <= 1) {
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

    // Use the DB function to handle complete cleanup of profile + related data
    interface DeleteUserResult {
      success: boolean;
      error?: string;
      message?: string;
      user_id?: string;
      admin_id?: string;
    }

    let rpcResult: DeleteUserResult | undefined;
    try {
      const { rows: rpcRows } = await query(
        `SELECT delete_user_completely($1, $2) AS result`,
        [userId, adminAuth.user.id],
      );
      rpcResult = rpcRows[0]?.result as DeleteUserResult | undefined;
    } catch (rpcError) {
      console.error(`[DELETE USER] delete_user_completely error:`, rpcError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete user",
        },
        { status: 500 },
      );
    }

    if (!rpcResult || typeof rpcResult.success !== "boolean") {
      console.error(
        `[DELETE USER] delete_user_completely returned invalid result:`,
        rpcResult,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid response from user deletion service",
        },
        { status: 500 },
      );
    }

    if (!rpcResult.success) {
      console.error(`[DELETE USER] delete_user_completely returned failure:`, rpcResult);
      return NextResponse.json(
        {
          success: false,
          error: rpcResult.error || "User deletion failed",
        },
        { status: 500 },
      );
    }

    // Now delete the auth.users row - delete_user_completely only cleans up
    // the public schema; profiles.id and auth.users.id are linked by
    // convention (matching UUIDs), not an enforced foreign key.
    let authUserDeleted = true;
    try {
      await query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
    } catch (authDeleteError) {
      console.error(`[DELETE USER] Auth user deletion failed:`, authDeleteError);
      authUserDeleted = false;
      // Don't fail the entire operation - the profile and all related data
      // have already been successfully deleted
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
      details: {
        profile_deleted: true,
        related_data_cleaned: true,
        auth_user_handled: authUserDeleted,
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
