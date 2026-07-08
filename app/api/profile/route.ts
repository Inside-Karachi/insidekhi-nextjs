import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Pakistan phone number validation (supports various formats)
function validatePakistanPhone(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Pakistan phone patterns:
  // +92XXXXXXXXXX (13 digits with country code)
  // 92XXXXXXXXXX (12 digits with country code)
  // 03XXXXXXXXX (11 digits mobile)
  // 021XXXXXXXX (10-11 digits landline)

  if (cleaned.length === 13 && cleaned.startsWith("92")) return true;
  if (cleaned.length === 12 && cleaned.startsWith("92")) return true;
  if (cleaned.length === 11 && cleaned.startsWith("03")) return true;
  if (
    cleaned.length >= 10 &&
    cleaned.length <= 11 &&
    (cleaned.startsWith("021") ||
      cleaned.startsWith("042") ||
      cleaned.startsWith("051"))
  )
    return true;

  return false;
}

// Username validation
function validateUsername(username: string): boolean {
  // Username should be 3-30 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    const body = await request.json();
    const update: {
      full_name?: string | null;
      avatar_url?: string | null;
      username?: string | null;
      phone?: string | null;
      membership_plan?: string | null;
      organizer_bio?: string | null;
      organizer_company?: string | null;
      organizer_website?: string | null;
    } = {};

    // Validate and set full_name
    if (typeof body.full_name === "string") {
      const trimmedName = body.full_name.trim();
      if (trimmedName.length > 100) {
        return NextResponse.json(
          {
            error: "validation_error",
            message: "Full name must be less than 100 characters",
            field: "full_name",
          },
          { status: 400 }
        );
      }
      update.full_name = trimmedName || null;
    }

    // Validate and set avatar_url
    if (body.avatar_url === null || typeof body.avatar_url === "string") {
      update.avatar_url = body.avatar_url || null;
    }

    // Validate and set username
    if (typeof body.username === "string") {
      const trimmedUsername = body.username.trim().toLowerCase();
      if (trimmedUsername && !validateUsername(trimmedUsername)) {
        return NextResponse.json(
          {
            error: "validation_error",
            message:
              "Username must be 3-30 characters and contain only letters, numbers, and underscores",
            field: "username",
          },
          { status: 400 }
        );
      }

      // Check username uniqueness if provided
      if (trimmedUsername) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", trimmedUsername)
          .neq("id", user.id)
          .single();

        if (existingUser) {
          return NextResponse.json(
            {
              error: "validation_error",
              message: "Username is already taken",
              field: "username",
            },
            { status: 400 }
          );
        }
      }

      update.username = trimmedUsername || null;
    }

    // Validate and set phone
    if (typeof body.phone === "string") {
      const trimmedPhone = body.phone.trim();
      if (trimmedPhone && !validatePakistanPhone(trimmedPhone)) {
        return NextResponse.json(
          {
            error: "validation_error",
            message: "Please enter a valid Pakistan phone number",
            field: "phone",
          },
          { status: 400 }
        );
      }
      update.phone = trimmedPhone || null;
    }

    // Validate and set membership_plan (only for business owners)
    if (typeof body.membership_plan === "string") {
      // First get current user profile to check role
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (currentProfile?.role !== "business_owner") {
        // Ignore membership_plan set attempts from non-business accounts to prevent errors
        console.warn(
          "Ignoring membership_plan update for non-business user",
          user.id
        );
      } else {
        const validPlans = ["basic", "premium", "enterprise"];
        const trimmedPlan = body.membership_plan.trim().toLowerCase();
        if (trimmedPlan && !validPlans.includes(trimmedPlan)) {
          return NextResponse.json(
            {
              error: "validation_error",
              message:
                "Invalid membership plan. Must be one of: basic, premium, enterprise",
              field: "membership_plan",
            },
            { status: 400 }
          );
        }

        update.membership_plan = trimmedPlan || null;
      }
    }

    // Validate organizer-specific fields (bio/company/website)
    if (typeof body.organizer_company === "string") {
      const trimmedCompany = body.organizer_company.trim();
      if (trimmedCompany.length > 100) {
        return NextResponse.json(
          {
            error: "validation_error",
            message: "Company name must be less than 100 characters",
            field: "organizer_company",
          },
          { status: 400 }
        );
      }
      update.organizer_company = trimmedCompany || null;
    }

    if (typeof body.organizer_bio === "string") {
      const trimmedBio = body.organizer_bio.trim();
      if (trimmedBio.length > 500) {
        return NextResponse.json(
          {
            error: "validation_error",
            message: "Bio must be less than 500 characters",
            field: "organizer_bio",
          },
          { status: 400 }
        );
      }
      update.organizer_bio = trimmedBio || null;
    }

    if (typeof body.organizer_website === "string") {
      const trimmedWebsite = body.organizer_website.trim();
      if (trimmedWebsite) {
        try {
          // URL() validates
          // Accept protocol-less URLs by prepending http://, but require host
          const parsed = new URL(
            trimmedWebsite.startsWith("http")
              ? trimmedWebsite
              : `https://${trimmedWebsite}`
          );
          if (!parsed.hostname) {
            throw new Error("Invalid website URL");
          }
          update.organizer_website = parsed.href || null;
        } catch {
          return NextResponse.json(
            {
              error: "validation_error",
              message: "Please enter a valid website URL",
              field: "organizer_website",
            },
            { status: 400 }
          );
        }
      } else {
        update.organizer_website = null;
      }
    }

    // Get current profile data for logging
    const { data: currentProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("Error fetching current profile:", fetchError);
    }

    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", user.id);

    if (error) {
      // Handle specific database errors
      if (
        error.code === "23505" &&
        error.message.includes("idx_profiles_username_unique")
      ) {
        return NextResponse.json(
          {
            error: "validation_error",
            message: "Username is already taken",
            field: "username",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get updated profile data for logging
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Log the profile update
    if (currentProfile && updatedProfile) {
      try {
        const { logProfileUpdate } = await import("@/lib/audit");
        await logProfileUpdate(
          user.id,
          currentProfile,
          updatedProfile,
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown"
        );
      } catch (logError) {
        console.error("Failed to log profile update:", logError);
        // Don't fail the operation if logging fails
      }
    }

    // Check for "profile_complete" XP award
    // Definition of 'complete': full_name, username, and phone are present
    if (
      updatedProfile?.full_name &&
      updatedProfile?.username &&
      updatedProfile?.phone
    ) {
      try {
        const { awardXP } = await import("@/lib/gamification");
        // This activity is set to 'once' in the DB, so awardXP handles duplication checks
        await awardXP(user.id, "profile_complete");
      } catch (xpError) {
        console.error("Failed to award profile_complete XP:", xpError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, username, phone, membership_plan, role, points, created_at, updated_at, organizer_bio, organizer_company, organizer_website"
      )
      .eq("id", user.id)
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
