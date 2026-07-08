import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  getSupabaseClientForRole,
} from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const rating = searchParams.get("rating") || "";

    const offset = (page - 1) * limit;

    // Build query for reviews with related data
    let query = adminSupabase
      .from("reviews")
      .select(
        `
        *,
        helpful_count,
        user:profiles!user_id (
          full_name,
          avatar_url
        ),
        listings:listing_id (
          name,
          slug
        ),
        review_images (
          id,
          image_url
        ),
        review_comments (
          id
        )
      `,
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(
        `comment.ilike.%${search}%,user.full_name.ilike.%${search}%,listings.name.ilike.%${search}%`,
      );
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (rating && rating !== "all") {
      query = query.eq("rating", parseInt(rating));
    }

    // Get paginated results
    const {
      data: reviews,
      error: reviewsError,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (reviewsError) {
      throw reviewsError;
    }

    interface ReviewData {
      user?: { full_name?: string | null; avatar_url?: string | null };
      listings?: { name?: string | null; slug?: string | null };
      review_images?: unknown[];
      helpful_count?: number;
      review_comments?: unknown[];
      status?: string;
    }

    // Transform data to match our types
    const transformedReviews =
      reviews?.map((review: unknown) => {
        const reviewData = review as ReviewData & Record<string, unknown>;
        return {
          ...reviewData,
          user_name: reviewData.user?.full_name || null,
          user_avatar: reviewData.user?.avatar_url || null,
          listing_name: reviewData.listings?.name || null,
          listing_slug: reviewData.listings?.slug || null,
          images: reviewData.review_images || [],
          helpful_count: reviewData.helpful_count || 0,
          comment_count: (reviewData.review_comments?.length as number) || 0,
          status: reviewData.status || "pending",
        };
      }) || [];

    // Get statistics
    const { data: statsData, error: statsError } = await adminSupabase
      .from("reviews")
      .select("rating, status");

    const statistics = {
      totalReviews: 0,
      pendingReviews: 0,
      approvedReviews: 0,
      rejectedReviews: 0,
      flaggedReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      // Comment statistics
      totalComments: 0,
      pendingComments: 0,
      approvedComments: 0,
      rejectedComments: 0,
      flaggedComments: 0,
    };

    if (!statsError && statsData) {
      statistics.totalReviews = statsData.length;

      // Count reviews by status
      statsData.forEach((review: { status: string | null; rating: number }) => {
        switch (review.status) {
          case "pending":
            statistics.pendingReviews++;
            break;
          case "approved":
            statistics.approvedReviews++;
            break;
          case "rejected":
            statistics.rejectedReviews++;
            break;
          case "flagged":
            statistics.flaggedReviews++;
            break;
          default:
            statistics.pendingReviews++; // Default to pending for null/undefined status
        }

        // Calculate rating distribution (only for approved reviews)
        if (review.status === "approved") {
          statistics.ratingDistribution[
            review.rating as keyof typeof statistics.ratingDistribution
          ]++;
        }
      });

      // Calculate average rating from approved reviews only
      const approvedReviews = statsData.filter(
        (review: { status: string | null }) => review.status === "approved",
      );
      if (approvedReviews.length > 0) {
        const totalRating = approvedReviews.reduce(
          (sum: number, review: { rating: number }) => sum + review.rating,
          0,
        );
        statistics.averageRating = totalRating / approvedReviews.length;
      }
    }

    // Get comment statistics
    const { data: commentStatsData, error: commentStatsError } =
      await adminSupabase.from("review_comments").select("status");

    if (!commentStatsError && commentStatsData) {
      statistics.totalComments = commentStatsData.length;

      // Count comments by status
      commentStatsData.forEach((comment: { status: string | null }) => {
        switch (comment.status) {
          case "pending":
            statistics.pendingComments++;
            break;
          case "approved":
            statistics.approvedComments++;
            break;
          case "rejected":
            statistics.rejectedComments++;
            break;
          case "flagged":
            statistics.flaggedComments++;
            break;
          default:
            statistics.pendingComments++; // Default to pending for null/undefined status
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        reviews: transformedReviews,
        total: count || 0,
        page,
        limit,
        statistics,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/reviews error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const body = await request.json();
    const { listing_id, user_id, rating, comment } = body;

    if (!listing_id || !user_id || !rating) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if review already exists for this user and listing
    const { data: existingReview } = await adminSupabase
      .from("reviews")
      .select("id")
      .eq("listing_id", listing_id)
      .eq("user_id", user_id)
      .single();

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: "User has already reviewed this listing" },
        { status: 409 },
      );
    }

    // Create the review
    const { data: review, error: reviewError } = await adminSupabase
      .from("reviews")
      .insert({
        listing_id,
        branch_id: 1, // Default to first branch for admin-created reviews
        user_id,
        rating,
        comment,
      })
      .select()
      .single();

    if (reviewError) {
      throw reviewError;
    }

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error("POST /api/admin/reviews error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create review" },
      { status: 500 },
    );
  }
}
