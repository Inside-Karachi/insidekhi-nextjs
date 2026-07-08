import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import type { Database } from "@/types/supabase";

const ROUTE = "/api/admin/users";

type UserRole = Database["public"]["Enums"]["user_role"];

interface AuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  created_at: string;
}

// GET /api/admin/users - Get all users with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Use existing admin authentication utility
    const adminAuth = await requireAdmin(request);

    // After admin is verified, use service role client to bypass RLS
    const supabase = await createServerSupabase({ useServiceRole: true });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    const offset = (page - 1) * limit;

    // Build query for users with profiles using service role client
    let query = supabase.from("profiles").select(
      `
        id,
        full_name,
        username,
        avatar_url,
        role,
        active_role,
        membership_plan,
        phone,
        created_at,
        updated_at
      `,
      { count: "exact" },
    );

    // Hide super_admins from regular admins (only super_admin can see super_admins)
    if (adminAuth.profile.role !== "super_admin") {
      query = query.neq("role", "super_admin");
    }

    // Apply filters
    if (search) {
      query = query.ilike("full_name", `%${search}%`);
    }

    if (
      role &&
      [
        "public_user",
        "business_owner",
        "writer",
        "lister",
        "admin",
        "super_admin",
      ].includes(role)
    ) {
      query = query.eq("role", role as UserRole);
    }

    if (status === "active") {
      // Users who signed in within last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte("updated_at", thirtyDaysAgo.toISOString());
    } else if (status === "inactive") {
      // Users who haven't signed in for 30+ days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.lt("updated_at", thirtyDaysAgo.toISOString());
    }

    // Apply pagination and ordering
    const {
      data: users,
      error: usersError,
      count,
    } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (usersError) {
      console.error("[USERS API] Database error:", usersError);
      captureRouteError(usersError, { route: ROUTE, method: "GET" });
      return NextResponse.json(
        { success: false, error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    // Get auth user data separately using service role only for this specific operation
    const userIds = users?.map((u) => u.id) || [];
    let authUsers: AuthUser[] = [];

    if (userIds.length > 0) {
      // Use service role only for auth.admin.listUsers() operation
      const adminSupabase = await createServerSupabase({
        useServiceRole: true,
      });
      const { data: authData } = await adminSupabase.auth.admin.listUsers();
      authUsers =
        (authData?.users?.filter((u: AuthUser) =>
          userIds.includes(u.id),
        ) as AuthUser[]) || [];
    }

    // Transform data for frontend
    const transformedUsers =
      users?.map((user) => {
        const authUser = authUsers.find((au) => au.id === user.id);
        return {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: authUser?.email || null,
          avatar_url: user.avatar_url,
          role: user.role,
          active_role: user.active_role,
          membership_plan: user.membership_plan,
          phone: user.phone,
          email_confirmed: !!authUser?.email_confirmed_at,
          last_sign_in: authUser?.last_sign_in_at || null,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      data: {
        users: transformedUsers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        filters: {
          search,
          role,
          status,
        },
      },
    });
  } catch (error) {
    console.error("Admin users API error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// POST /api/admin/users - Create a new user
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Use existing admin authentication utility
    const adminAuth = await requireAdmin(request);
    const supabase = await createServerSupabase();

    // Rate limiting: Prevent abuse
    const { userCreationLimiter } = await import("@/lib/rate-limiter");
    const rateLimitCheck = userCreationLimiter.check(adminAuth.user.id);

    if (!rateLimitCheck.allowed) {
      const resetInSeconds = Math.ceil(
        (rateLimitCheck.resetTime - Date.now()) / 1000,
      );
      console.error(
        `[CREATE USER] Rate limit exceeded for admin ${adminAuth.user.id}. Reset in ${resetInSeconds}s`,
      );
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. You can create ${rateLimitCheck.remaining} more users. Try again in ${resetInSeconds} seconds.`,
          retryAfter: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": resetInSeconds.toString(),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": rateLimitCheck.remaining.toString(),
            "X-RateLimit-Reset": new Date(
              rateLimitCheck.resetTime,
            ).toISOString(),
          },
        },
      );
    }

    // Parse request body
    const body = await request.json();
    const { full_name, username, email, role, membership_plan, phone } = body;

    // Validate required fields
    if (!email || !role) {
      console.error(`[CREATE USER] Validation failed: email or role missing`);
      return NextResponse.json(
        { success: false, error: "Email and role are required" },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(`[CREATE USER] Invalid email format: ${email}`);
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 },
      );
    }

    // Check for disposable email domains
    const disposableDomains = await import("disposable-email-domains");
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (emailDomain && disposableDomains.default.includes(emailDomain)) {
      console.error(
        `[CREATE USER] Disposable email domain detected: ${emailDomain}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Disposable email addresses are not allowed",
        },
        { status: 400 },
      );
    }

    // Validate role
    if (
      ![
        "public_user",
        "business_owner",
        "writer",
        "lister",
        "organizer",
        "admin",
        "super_admin",
      ].includes(role)
    ) {
      console.error(`[CREATE USER] Invalid role: ${role}`);
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 },
      );
    }

    // Get admin's role for role escalation check
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });
    const { data: adminProfile } = await serviceSupabase
      .from("profiles")
      .select("role")
      .eq("id", (await supabase.auth.getUser()).data.user!.id)
      .single();

    // Prevent role escalation: Only super_admin can create super_admin users
    if (role === "super_admin" && adminProfile?.role !== "super_admin") {
      console.error(
        `[CREATE USER] Regular admin attempted to create super_admin user`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Only super_admin can create super_admin users",
        },
        { status: 403 },
      );
    }

    // Prevent role escalation: Only super_admin can create admin users
    if (role === "admin" && adminProfile?.role !== "super_admin") {
      console.error(
        `[CREATE USER] Regular admin attempted to create admin user`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Only super_admin can create admin users",
        },
        { status: 403 },
      );
    }

    // Validate username if provided
    if (username) {
      // Check username format
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(username)) {
        console.error(`[CREATE USER] Invalid username format: ${username}`);
        return NextResponse.json(
          {
            success: false,
            error:
              "Username must be 3-30 characters and contain only letters, numbers, and underscores",
          },
          { status: 400 },
        );
      }

      // Check if username is already taken
      const { data: existingUsername } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .single();

      if (existingUsername) {
        console.error(`[CREATE USER] Username already taken: ${username}`);
        return NextResponse.json(
          { success: false, error: "Username is already taken" },
          { status: 409 },
        );
      }
    }

    // Check if user with this email already exists
    // Use service role only for auth operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });
    const { data: existingUser } = await adminSupabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(
      (u: AuthUser) => u.email === email,
    );

    if (userExists) {
      console.error(`[CREATE USER] User with email already exists: ${email}`);
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Generate secure temporary password
    const crypto = await import("crypto");
    const tempPassword = crypto.randomBytes(8).toString("hex") + "Temp!";

    // Create auth user using service role
    const { data: authUser, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || null,
          username: username || null,
          // Pass role so the handle_new_user DB trigger creates the profile
          // with the correct role and active_role from the start.
          role: role,
        },
      });

    if (createError || !authUser.user) {
      console.error(`[CREATE USER] Create user error:`, createError);
      captureRouteError(
        createError ?? new Error("Auth user creation returned no user"),
        {
          route: ROUTE,
          method: "POST",
          extra: { stage: "create_auth_user" },
        },
      );
      return NextResponse.json(
        { success: false, error: "Failed to create user" },
        { status: 500 },
      );
    }

    // Check if profile already exists before creating
    const { data: existingProfile } = await adminSupabase
      .from("profiles")
      .select("id, role")
      .eq("id", authUser.user.id)
      .single();

    if (existingProfile) {
      // Update the existing profile using service role to ensure role can be set
      const { error: profileUpdateError } = await adminSupabase
        .from("profiles")
        .update({
          full_name: full_name || null,
          username: username || null,
          role: role as UserRole,
          // CRITICAL: active_role must also be updated. The handle_new_user trigger
          // may have created the profile with active_role = 'public_user' if the
          // role wasn't in user_metadata. This ensures the dashboard shows correctly.
          active_role: role as UserRole,
          membership_plan: membership_plan || "free",
          phone: phone || null,
        })
        .eq("id", authUser.user.id);

      if (profileUpdateError) {
        console.error(
          `[CREATE USER] Profile update error:`,
          profileUpdateError,
        );
        // Try to delete the auth user if profile update failed
        await adminSupabase.auth.admin.deleteUser(authUser.user.id);
        captureRouteError(profileUpdateError, {
          route: ROUTE,
          method: "POST",
          extra: { stage: "update_profile" },
        });
        return NextResponse.json(
          { success: false, error: "Failed to update user profile" },
          { status: 500 },
        );
      }
    } else {
      // Create new profile using service role to bypass RLS and ensure role can be set
      const { error: profileCreateError } = await adminSupabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          full_name: full_name || null,
          username: username || null,
          role: role as UserRole,
          active_role: role as UserRole, // Default active_role = role
          membership_plan: membership_plan || "free",
          phone: phone || null,
        });

      if (profileCreateError) {
        console.error(
          `[CREATE USER] Profile creation error:`,
          profileCreateError,
        );
        // Try to delete the auth user if profile creation failed
        await adminSupabase.auth.admin.deleteUser(authUser.user.id);
        captureRouteError(profileCreateError, {
          route: ROUTE,
          method: "POST",
          extra: { stage: "create_profile" },
        });
        return NextResponse.json(
          { success: false, error: "Failed to create user profile" },
          { status: 500 },
        );
      }
    }

    // Verify the role was set correctly
    const { data: verifiedProfile, error: verifyError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", authUser.user.id)
      .single();

    if (verifyError || !verifiedProfile || verifiedProfile.role !== role) {
      console.error(
        `[CREATE USER] Role verification failed. Expected: ${role}, Got: ${verifiedProfile?.role}`,
      );
      // Delete auth user if role wasn't set correctly
      await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      captureRouteError(
        verifyError ?? new Error("Role verification mismatch"),
        {
          route: ROUTE,
          method: "POST",
          extra: { stage: "verify_role", expectedRole: role },
        },
      );
      return NextResponse.json(
        {
          success: false,
          error: "Failed to assign user role correctly",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: authUser.user.id,
          full_name: full_name || null,
          username: username || null,
          email: authUser.user.email,
          role,
          membership_plan: membership_plan || "free",
          phone: phone || null,
          email_confirmed: authUser.user.email_confirmed_at ? true : false,
          created_at: authUser.user.created_at,
          updated_at: new Date().toISOString(),
        },
        tempPassword: tempPassword, // Include temporary password for admin
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CREATE USER] Unexpected error after ${duration}ms:`, error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
