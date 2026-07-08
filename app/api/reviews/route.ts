import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Validation schema for review creation (with branch_id)
const createReviewSchema = z.object({
  listing_id: z.number().int().positive(),
  branch_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(500).trim(),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createReviewSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { listing_id, branch_id, rating, comment } = validationResult.data;

    // Verify that the listing exists and is published
    const { data: listing, error: listingError } = await supabase
      .from("listings_with_details")
      .select("id, name, status")
      .eq("id", listing_id)
      .eq("status", "published")
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: "Listing not found or not available for reviews" },
        { status: 404 },
      );
    }

    // Verify branch belongs to this listing
    const { data: branch, error: branchError } = await supabase
      .from("listing_branches")
      .select("id, name")
      .eq("id", branch_id)
      .eq("listing_id", listing_id)
      .single();

    if (branchError || !branch) {
      return NextResponse.json(
        { error: "Branch not found for this listing" },
        { status: 404 },
      );
    }

    // Check if user has reviewed this branch before (for image requirement)
    const { data: reviewCountData, error: countError } = await supabase.rpc(
      "get_user_branch_review_count",
      {
        p_user_id: user.id,
        p_branch_id: branch_id,
      },
    );

    if (countError) {
      console.error("Review count check error:", countError);
      // Non-critical - continue with submission
    }

    // Type assertion for RPC return
    const reviewCount = Array.isArray(reviewCountData)
      ? (reviewCountData[0] as
          | {
              total_reviews: number;
              requires_image: boolean;
            }
          | undefined)
      : undefined;

    // Image requirement: First review = optional, 2nd+ = REQUIRED
    // Note: Enforced client-side. Admin moderation catches violations.
    const _requiresImage = reviewCount?.requires_image || false;

    // Check for suspicious patterns (auto-flag, but don't block)
    const { data: suspiciousData } = await supabase.rpc(
      "check_suspicious_review_pattern",
      {
        p_user_id: user.id,
        p_branch_id: branch_id,
      },
    );

    const suspiciousPattern = Array.isArray(suspiciousData)
      ? (suspiciousData[0] as
          | { is_suspicious: boolean; reason: string }
          | undefined)
      : undefined;

    // CRITICAL: Block staff from reviewing listings they manage
    const { data: managesListing } = await supabase.rpc(
      "user_manages_listing",
      {
        p_user_id: user.id,
        p_listing_id: listing_id,
      },
    );

    if (managesListing === true) {
      return NextResponse.json(
        {
          error: "Conflict of Interest",
          message:
            "Staff members cannot review listings they manage. Please switch to a personal account if you wish to leave a review as a customer.",
        },
        { status: 403 },
      );
    }

    // Create the review
    const reviewData = {
      listing_id,
      branch_id,
      user_id: user.id,
      rating,
      comment,
      status: "pending" as const, // Reviews need moderation
      is_flagged_suspicious: suspiciousPattern?.is_suspicious || false,
      created_at: new Date().toISOString(),
    };

    const { data: review, error: insertError } = await supabase
      .from("reviews")
      .insert(reviewData)
      .select(
        `
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `,
      )
      .single();

    if (insertError) {
      console.error("Error creating review:", insertError);
      captureRouteError(insertError, { route: "/api/reviews", method: "POST" });
      return NextResponse.json(
        { error: "Failed to create review" },
        { status: 500 },
      );
    }

    // Log the review creation for audit purposes
    try {
      await supabase.from("audit_logs").insert({
        action: "review_created",
        entity_type: "review",
        entity_id: review.id.toString(),
        user_id: user.id,
        metadata: {
          listing_id,
          listing_name: listing.name,
          rating,
          status: "pending",
        },
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error("Audit logging failed:", auditError);
    }

    // NOTE: Do NOT award XP here - reviews are pending moderation
    // XP will be awarded when admin approves the review via /api/admin/reviews/[id]/moderate
    // This prevents XP farming via spam reviews that get rejected

    // === SMART NOTIFICATIONS (Prevent Admin Spam) ===
    try {
      const adminSupabase = await createServerSupabase({
        useServiceRole: true,
      });
      const { createNotification } = await import("@/lib/notifications");

      // 1. Notify listing owner (always)
      const { data: listingOwner } = await adminSupabase
        .from("listings")
        .select("created_by")
        .eq("id", listing_id)
        .single();

      if (listingOwner?.created_by && listingOwner.created_by !== user.id) {
        await createNotification({
          recipientId: listingOwner.created_by,
          roleScope: "lister",
          categorySlug: "general",
          title: "New Review on Your Listing",
          body: `${listing.name} received a ${rating}-star review from a customer.`,
          priority: "normal",
          ctaLabel: "View Review",
          ctaUrl: `/admin/reviews`,
          metadata: {
            review_id: review.id,
            listing_id,
            listing_name: listing.name,
            rating,
          },
        });
      }

      // 2. Notify admins ONLY if flagged as suspicious (prevent spam)
      if (suspiciousPattern?.is_suspicious) {
        const { data: admins } = await adminSupabase
          .from("profiles")
          .select("id")
          .in("role", ["admin", "super_admin"]);

        for (const admin of admins || []) {
          if (admin.id !== user.id) {
            await createNotification({
              recipientId: admin.id,
              roleScope: "admin",
              categorySlug: "general",
              title: "⚠️ Suspicious Review Flagged",
              body: `Review for "${listing.name}" flagged as suspicious. Immediate moderation required.`,
              priority: "high",
              ctaLabel: "Review Now",
              ctaUrl: `/admin/reviews`,
              metadata: {
                review_id: review.id,
                listing_id,
                listing_name: listing.name,
                rating,
                reason: suspiciousPattern.reason,
              },
            });
          }
        }
      }
    } catch (notificationError) {
      // Don't fail review submission if notifications fail
      console.error("Review notification failed:", notificationError);
    }

    return NextResponse.json({
      success: true,
      message: "Review submitted successfully and is pending moderation.",
      review: {
        ...review,
        profiles: review.profiles || null,
      },
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/reviews:", error);
    captureRouteError(error, { route: "/api/reviews", method: "POST" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET method to fetch reviews for a listing (for potential future use)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listing_id");

    if (!listingId) {
      return NextResponse.json(
        { error: "listing_id parameter is required" },
        { status: 400 },
      );
    }

    // Get authenticated user to check if they can see pending reviews
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isAdmin = user ? await checkAdminStatus(supabase, user.id) : false;

    // Build query based on user permissions
    let query = supabase
      .from("reviews")
      .select(
        `
        *,
        helpful_count,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `,
      )
      .eq("listing_id", parseInt(listingId))
      .order("created_at", { ascending: false });

    // Only show approved reviews to regular users
    if (!isAdmin) {
      query = query.eq("status", "approved");
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error("Error fetching reviews:", error);
      captureRouteError(error, { route: "/api/reviews", method: "GET" });
      return NextResponse.json(
        { error: "Failed to fetch reviews" },
        { status: 500 },
      );
    }

    // Get comment counts for each review
    if (reviews && reviews.length > 0) {
      const reviewIds = reviews.map((r) => r.id);
      const { data: commentCounts } = await supabase
        .from("review_comments")
        .select("review_id")
        .in("review_id", reviewIds)
        .eq("status", "approved");

      // Count comments per review
      const commentCountMap = new Map<number, number>();
      commentCounts?.forEach((comment) => {
        const count = commentCountMap.get(comment.review_id) || 0;
        commentCountMap.set(comment.review_id, count + 1);
      });

      // Add comment count to each review
      const reviewsWithCommentCount = reviews.map((review) => ({
        ...review,
        comment_count: commentCountMap.get(review.id) || 0,
      }));

      return NextResponse.json({
        reviews: reviewsWithCommentCount,
        total: reviewsWithCommentCount.length,
      });
    }

    return NextResponse.json({
      reviews: [],
      total: 0,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/reviews:", error);
    captureRouteError(error, { route: "/api/reviews", method: "GET" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Helper function to check admin status
async function checkAdminStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    return profile?.role === "admin" || profile?.role === "super_admin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}
