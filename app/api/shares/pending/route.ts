import { createServerSupabase } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { createClient } from "@supabase/supabase-js";
import { canModerateShares } from "@/lib/auth/gamification-permissions";

export const dynamic = "force-dynamic";

// Helper to get supabaseAdmin lazily
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}


export async function GET(_request: NextRequest) {
    const supabase = await createServerSupabase();
  try {    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has permission (admin or super_admin only)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (
      profileError ||
      !profile ||
      !canModerateShares(profile.role)
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch pending shares with user profiles using explicit join
    const { data: shares, error } = await supabase
      .from("social_shares")
      .select("*")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching pending shares:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch pending shares",
        },
        { status: 500 }
      );
    }

    // Manually fetch user profiles for each share
    const userIds = Array.from(
      new Set(shares?.map((s) => s.user_id).filter(Boolean) || [])
    );

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Generate Signed URLs for screenshots (since bucket is private)
    const sharesWithSignedUrls = await Promise.all(
      (shares || []).map(async (share) => {
        let signedUrl = share.screenshot_url;

        if (share.screenshot_url && share.screenshot_url.includes("share-screenshots")) {
          try {
            // Extract path: everything after "share-screenshots/"
            // URL format: .../share-screenshots/user_id/filename.jpg
            const pathParts = share.screenshot_url.split("share-screenshots/");
            if (pathParts.length > 1) {
              const filePath = pathParts[1]; // "user_id/filename.jpg"

              // Remove query params if any
              const cleanPath = filePath.split("?")[0];

              const { data: signedData } = await getSupabaseAdmin().storage
                .from("share-screenshots")
                .createSignedUrl(cleanPath, 60 * 60); // 1 hour validity

              if (signedData?.signedUrl) {
                signedUrl = signedData.signedUrl;
              }
            }
          } catch (e) {
            console.error("Error signing URL for share:", share.id, e);
          }
        }

        return {
          ...share,
          screenshot_url: signedUrl,
          profiles: profiles?.find((p) => p.id === share.user_id),
        };
      })
    );

    return NextResponse.json({
      success: true,
      shares: sharesWithSignedUrls,
    });
  } catch (error) {
    console.error("Unexpected error in pending shares:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
