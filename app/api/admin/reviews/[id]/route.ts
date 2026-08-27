import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

async function getAdminProfile(userId: string) {
  const { rows } = await query(
    "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
    [userId]
  );
  return rows[0] as { role: string } | undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;    // Check admin authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const profile = await getAdminProfile(session.userId);

    if (!profile) {
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
    const { rows } = await query(
      `SELECT
         r.*,
         p.full_name  AS user_name,
         p.avatar_url AS user_avatar,
         l.name       AS listing_name,
         l.slug       AS listing_slug,
         COALESCE((SELECT json_agg(ri) FROM public.review_images ri WHERE ri.review_id = r.id), '[]') AS images
       FROM public.reviews r
       LEFT JOIN public.profiles p ON p.id = r.user_id
       LEFT JOIN public.listings l ON l.id = r.listing_id
       WHERE r.id = $1
       LIMIT 1`,
      [reviewId]
    );
    const review = rows[0];

    if (!review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...review,
        helpful_count: review.helpful_count || 0,
        status: review.status || "pending",
      },
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
    const { id } = await params;    // Check admin authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const profile = await getAdminProfile(session.userId);

    if (!profile) {
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
    const { rows } = await query(
      `UPDATE public.reviews
       SET rating = $1, comment = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [rating, comment, reviewId]
    );
    const review = rows[0];

    if (!review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
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
    const { id } = await params;    // Check admin authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const profile = await getAdminProfile(session.userId);

    if (!profile) {
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
    const { rows: reviewRows } = await query(
      "SELECT listing_id, user_id FROM public.reviews WHERE id = $1 LIMIT 1",
      [reviewId]
    );
    const reviewData = reviewRows[0] as
      | { listing_id: number; user_id: string }
      | undefined;

    // Delete the review (cascade will handle related records)
    await query("DELETE FROM public.reviews WHERE id = $1", [reviewId]);

    if (reviewData) {
      try {
        const { cleanupLeaveReviewXpOnDelete } = await import(
          "@/lib/reviews/moderation-xp"
        );
        await cleanupLeaveReviewXpOnDelete({
          reviewId,
          userId: reviewData.user_id,
          listingId: reviewData.listing_id,
        });
      } catch (xpError) {
        console.error("Failed to cleanup XP log:", xpError);
      }
    }

    // The content is gone - resolve any pending reports against it so they
    // don't sit in the queue forever.
    try {
      await query(
        `UPDATE public.content_reports
         SET status = 'resolved', resolved_by = $1, resolved_at = now()
         WHERE content_type = 'review' AND content_id = $2 AND status = 'pending'`,
        [session.userId, reviewId],
      );
    } catch (reportsError) {
      console.error("Failed to auto-resolve content reports:", reportsError);
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
