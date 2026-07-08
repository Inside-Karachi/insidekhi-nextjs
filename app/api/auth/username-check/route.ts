import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  UsernameCheckRequest,
  UsernameCheckResponse,
  AUTH_VALIDATION,
} from "@/types/auth.types";

// Username validation function
function validateUsername(username: string): boolean {
  const { minLength, maxLength, pattern } = AUTH_VALIDATION.username;
  return (
    username.length >= minLength &&
    username.length <= maxLength &&
    pattern.test(username)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: UsernameCheckRequest = await request.json();
    const { username } = body;

    // Basic validation
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        {
          available: false,
          message: "Username is required",
        } as UsernameCheckResponse,
        { status: 400 }
      );
    }

    // Trim and lowercase for consistency
    const trimmedUsername = username.trim().toLowerCase();

    // Validate username format
    if (!validateUsername(trimmedUsername)) {
      return NextResponse.json(
        {
          available: false,
          message: AUTH_VALIDATION.username.patternDescription,
        } as UsernameCheckResponse,
        { status: 400 }
      );
    }

    // Check availability in database using direct PG query
    let existingUser = null;
    try {
      const res = await query(
        "SELECT id FROM profiles WHERE username ILIKE $1 LIMIT 1",
        [trimmedUsername]
      );
      existingUser = res.rows[0];
    } catch (error) {
      console.error("Username availability check failed:", error);
      return NextResponse.json(
        {
          available: false,
          message: "Unable to check username availability",
        } as UsernameCheckResponse,
        { status: 500 }
      );
    }

    const isAvailable = !existingUser;

    return NextResponse.json({
      available: isAvailable,
      message: isAvailable
        ? "Username is available"
        : "Username is already taken",
    } as UsernameCheckResponse);
  } catch (error) {
    console.error("Username check error:", error);
    return NextResponse.json(
      {
        available: false,
        message: "An error occurred while checking username availability",
      } as UsernameCheckResponse,
      { status: 500 }
    );
  }
}
