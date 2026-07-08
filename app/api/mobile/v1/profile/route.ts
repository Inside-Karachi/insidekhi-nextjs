import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  PROFILE_COLUMNS,
  buildProfileUpdate,
  profilePatchSchema,
  type ProfileRow,
} from "@/lib/mobile/profile";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/profile
 *
 * The authenticated caller's own profile (RLS scopes the read to the caller).
 * Returns only the allow-listed profile columns.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single<ProfileRow>();

  if (error || !profile) {
    throw new MobileApiError("not_found", "Profile not found.", 404);
  }

  return ok(profile);
});

/**
 * PATCH /api/mobile/v1/profile
 *
 * Partial self-update of the caller's profile. Writes go through the user's RLS
 * client AND a strict server-side column allow-list (`buildProfileUpdate`) -
 * privileged columns (role, points, verification flags) are never representable,
 * so they can't be written even though the `profiles` UPDATE policy is row-level
 * only. `membership_plan` is gated to business accounts; avatars change via
 * POST /profile/avatar (PATCH can only clear `avatar_url`). Mirrors
 * `app/api/profile` (PUT).
 */
export const PATCH = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = profilePatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    throw new MobileApiError(
      "validation_error",
      issue?.message ?? "Invalid profile update.",
      400,
      issue?.path.join(".") || undefined,
    );
  }

  const { data: current, error: roleError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (roleError) {
    console.error(
      "[mobile-api] profile role lookup failed:",
      roleError.message,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to update profile.",
      500,
    );
  }

  const update = buildProfileUpdate(parsed.data, current?.role ?? null);

  // Username uniqueness (case-insensitive), excluding the caller's own row.
  if (typeof update.username === "string" && update.username) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", update.username)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) {
      throw new MobileApiError(
        "validation_error",
        "Username is already taken.",
        400,
        "username",
      );
    }
  }

  // Nothing valid to write (e.g. only a non-business membership_plan) -> no-op.
  if (Object.keys(update).length === 0) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", user.id)
      .single<ProfileRow>();
    if (error || !profile) {
      throw new MobileApiError("not_found", "Profile not found.", 404);
    }
    return ok(profile);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select(PROFILE_COLUMNS)
    .single<ProfileRow>();

  if (error || !profile) {
    if (error?.code === "23505") {
      throw new MobileApiError(
        "validation_error",
        "Username is already taken.",
        400,
        "username",
      );
    }
    console.error("[mobile-api] profile update failed:", error?.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to update profile.",
      500,
    );
  }

  // Parity with the website: award the one-time `profile_complete` XP once name,
  // username, and phone are all present. The activity is configured `once`, so
  // awardXP de-dupes; best-effort - a failure must not fail the update.
  if (profile.full_name && profile.username && profile.phone) {
    try {
      const { awardXP } = await import("@/lib/gamification");
      await awardXP(user.id, "profile_complete");
    } catch (err) {
      console.error("[mobile-api] profile_complete XP award failed:", err);
    }
  }

  return ok(profile);
});
