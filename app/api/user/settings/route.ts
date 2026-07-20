import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { z } from "zod";

// Validation schema for user preferences
const UserPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    bookings: z.boolean().optional(),
    reviews: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    name: z.string().optional(),
  }).optional(),
});

const UpdateSettingsSchema = z.object({
  userPreferences: UserPreferencesSchema,
});

// GET /api/user/settings - Get current user settings
export async function GET() {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { rows } = await query(
      `SELECT id, user_preferences FROM profiles WHERE id = $1 LIMIT 1`,
      [session.userId]
    );
    const profile = rows[0];

    return NextResponse.json({
      success: true,
      settings: profile?.user_preferences || {},
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/user/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/user/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { userPreferences } = validationResult.data;

    // Update user preferences in database
    let updatedPreferences: unknown;
    try {
      const { rows } = await query(
        `UPDATE profiles
         SET user_preferences = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING user_preferences`,
        [userPreferences, session.userId]
      );
      updatedPreferences = rows[0]?.user_preferences;
    } catch (error) {
      console.error("Error updating user settings:", error);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: updatedPreferences,
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/user/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
