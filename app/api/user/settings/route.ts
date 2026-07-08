import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, user_preferences")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

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
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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
    const { data, error } = await supabase
      .from("profiles")
      .update({
        user_preferences: userPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("user_preferences")
      .single();

    if (error) {
      console.error("Error updating user settings:", error);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: data?.user_preferences,
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/user/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
