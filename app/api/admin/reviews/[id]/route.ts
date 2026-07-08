import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabase();

    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Use service role client for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get user profile with role
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check admin or lister role
    if (
      profile.role !== "admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "lister"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const reviewId = parseInt(id);

    // Get review with related data
    const { data: review, error: reviewError } = await adminSupabase
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
        )
      `
      )
      .eq("id", reviewId)
      .single();

    if (reviewError) {
      if (reviewError.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Review not found" },
          { status: 404 }
        );
      }
      throw reviewError;
    }

    // Transform data
    const transformedReview = {
      ...review,
      user_name: review.user?.full_name || null,
      user_avatar: review.user?.avatar_url || null,
      listing_name: review.listings?.name || null,
      listing_slug: review.listings?.slug || null,
      images: review.review_images || [],
      helpful_count: review.helpful_count || 0,
      status: review.status || "pending", // Use actual status from database
    };

    return NextResponse.json({
      success: true,
      data: transformedReview,
    });
  } catch (error) {
    console.error("GET /api/admin/reviews/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch review" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabase();

    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Use service role client for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get user profile with role
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check admin or lister role
    if (
      profile.role !== "admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "lister"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const reviewId = parseInt(id);
    const body = await request.json();
    const { rating, comment } = body;

    // Update the review
    const { data: review, error: reviewError } = await adminSupabase
      .from("reviews")
      .update({
        rating,
        comment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .select()
      .single();

    if (reviewError) {
      if (reviewError.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Review not found" },
          { status: 404 }
        );
      }
      throw reviewError;
    }

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error("PUT /api/admin/reviews/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update review" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabase();

    // Check admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Use service role client for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Get user profile with role
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check admin role
    if (profile.role !== "admin" && profile.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const reviewId = parseInt(id);

    // Get review metadata before deletion for XP cleanup
    const { data: reviewData } = await adminSupabase
      .from("reviews")
      .select("listing_id, user_id")
      .eq("id", reviewId)
      .single();

    // Delete the review (cascade will handle related records)
    const { error: deleteError } = await adminSupabase
      .from("reviews")
      .delete()
      .eq("id", reviewId);

    if (deleteError) {
      throw deleteError;
    }

    if (reviewData) {
      try {
        const { cleanupLeaveReviewXpOnDelete } = await import(
          "@/lib/reviews/moderation-xp"
        );
        await cleanupLeaveReviewXpOnDelete(adminSupabase, {
          reviewId,
          userId: reviewData.user_id,
          listingId: reviewData.listing_id,
        });
      } catch (xpError) {
        console.error("Failed to cleanup XP log:", xpError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/admin/reviews/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete review" },
      { status: 500 }
    );
  }
}
