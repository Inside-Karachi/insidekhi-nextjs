import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import crypto from "crypto";

// Ticket verification for organizer check-in. Verifies code + signature, enforces organizer
// ownership, and awards XP once per ticket (guarded by checked_in_at).

interface VerifyRequest {
  code: string; // Ticket code (e.g., "IK-ABC123")
  eventId?: number; // Optional: For additional validation
}

interface VerifyResponse {
  success: boolean;
  message: string;
  ticket?: {
    id: number;
    code: string;
    status: string;
    guestName?: string;
    ticketType?: string;
    eventName?: string;
    alreadyCheckedIn: boolean;
    checkedInAt?: string;
  };
  xpAwarded?: number;
  error?: string;
}

// Verify HMAC signature for fraud prevention
function verifyTicketSignature(
  code: string,
  eventId: number,
  bookingId: number,
  storedSignature: string,
): boolean {
  const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
  if (!SIGNING_SECRET) {
    throw new Error(
      "TICKET_SIGNING_SECRET environment variable is not configured",
    );
  }
  const payload = `${code}:${eventId}:${bookingId}`;
  const expectedSignature = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex")
    .substring(0, 16); // First 16 chars for brevity

  return storedSignature === expectedSignature;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  try {
    const supabase = await createServerSupabase();
    const body: VerifyRequest = await request.json();
    const { code, eventId } = body;

    // Validate code format
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Ticket code is required",
          error: "INVALID_CODE",
        },
        { status: 400 },
      );
    }

    // Normalize code (uppercase, trim)
    const normalizedCode = code.toUpperCase().trim();

    // Validate IK- prefix
    if (!normalizedCode.startsWith("IK-")) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ticket code format. Must start with IK-",
          error: "INVALID_FORMAT",
        },
        { status: 400 },
      );
    }

    // Get authenticated user (organizer)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please log in.",
          error: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }

    // Fetch ticket pass with related data
    const { data: ticketPass, error: ticketError } = await supabase
      .from("ticket_passes")
      .select(
        `
        id,
        code,
        signature,
        status,
        guest_name,
        checked_in_at,
        booking_id,
        event_id,
        ticket_type_id,
        bookings!inner(
          id,
          user_id,
          payment_status
        ),
        events!inner(
          id,
          name,
          organizer_id
        ),
        ticket_types(
          name
        )
      `,
      )
      .eq("code", normalizedCode)
      .single();

    if (ticketError || !ticketPass) {
      return NextResponse.json(
        {
          success: false,
          message: "Ticket not found. Please check the code.",
          error: "NOT_FOUND",
        },
        { status: 404 },
      );
    }

    // Type assertions for nested relations
    const booking = ticketPass.bookings as {
      id: number;
      user_id: string;
      payment_status: string;
    };
    const event = ticketPass.events as {
      id: number;
      name: string;
      organizer_id: string;
    };
    const ticketType = ticketPass.ticket_types as { name: string } | null;

    // Verify organizer owns this event
    if (event.organizer_id !== user.id) {
      // Check if user is admin (can verify any ticket)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const isAdmin =
        profile?.role === "admin" || profile?.role === "super_admin";

      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            message: "You are not authorized to verify tickets for this event.",
            error: "FORBIDDEN",
          },
          { status: 403 },
        );
      }
    }

    // Optional: Verify event ID matches
    if (eventId && ticketPass.event_id !== eventId) {
      return NextResponse.json(
        {
          success: false,
          message: "Ticket does not belong to this event.",
          error: "EVENT_MISMATCH",
        },
        { status: 400 },
      );
    }

    // Verify ticket signature for fraud prevention
    const isSignatureValid = verifyTicketSignature(
      ticketPass.code,
      ticketPass.event_id,
      booking.id,
      ticketPass.signature,
    );

    if (!isSignatureValid) {
      // Log potential fraud attempt
      console.error(
        `[FRAUD_ALERT] Invalid signature for ticket ${ticketPass.code}`,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Ticket verification failed. This may be a fraudulent ticket.",
          error: "INVALID_SIGNATURE",
        },
        { status: 400 },
      );
    }

    // Check ticket status
    if (ticketPass.status === "revoked") {
      return NextResponse.json(
        {
          success: false,
          message: "This ticket has been revoked.",
          error: "REVOKED",
        },
        { status: 400 },
      );
    }

    // Reject check-in if payment is not complete
    if (
      booking.payment_status !== "paid" &&
      booking.payment_status !== "confirmed"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ticket cannot be checked in: payment has not been completed.",
          error: "PAYMENT_REQUIRED",
        },
        { status: 402 },
      );
    }

    // Check if already checked in
    const alreadyCheckedIn =
      ticketPass.status === "checked_in" || !!ticketPass.checked_in_at;

    let xpAwarded = 0;

    if (!alreadyCheckedIn) {
      // Conditional update: only update if checked_in_at is still NULL (atomic race protection)
      const { data: updatedRows, error: updateError } = await supabase
        .from("ticket_passes")
        .update({
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
        })
        .eq("id", ticketPass.id)
        .is("checked_in_at", null)
        .select("id");

      if (updateError) {
        console.error("Failed to update ticket status:", updateError);
        return NextResponse.json(
          {
            success: false,
            message: "Failed to check in ticket. Please try again.",
            error: "UPDATE_FAILED",
          },
          { status: 500 },
        );
      }

      // If no rows updated, another concurrent request already checked this ticket in
      if (!updatedRows || updatedRows.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Ticket already checked in",
          ticket: {
            id: ticketPass.id,
            code: ticketPass.code,
            status: "checked_in",
            guestName: ticketPass.guest_name || undefined,
            eventName: event.name,
            alreadyCheckedIn: true,
          },
          xpAwarded: 0,
        });
      }

      // Award XP for attending event
      const serviceSupabase = await createServerSupabase({
        useServiceRole: true,
      });

      // Get attend_event XP value from xp_activities
      // Note: activity_slug is "attend_event", activity_name is display name "Attend Event"
      const { data: xpActivity, error: xpQueryError } = await serviceSupabase
        .from("xp_activities")
        .select("xp_value")
        .eq("activity_slug", "attend_event")
        .eq("is_active", true)
        .single();

      if (xpQueryError) {
        console.error("Failed to fetch XP activity:", xpQueryError);
      }

      if (xpActivity) {
        xpAwarded = xpActivity.xp_value;

        // Award XP to ticket holder
        const { error: xpError } = await serviceSupabase
          .from("points_log")
          .insert({
            user_id: booking.user_id,
            points: xpAwarded,
            reason: `Attended event: ${event.name}`,
            related_id: ticketPass.id, // Store ticket_pass id for audit
          });

        if (xpError) {
          console.error("Failed to award XP:", xpError);
          // Don't fail the check-in, just log the error
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: alreadyCheckedIn
        ? "Ticket already checked in"
        : `Check-in successful!${
            xpAwarded > 0 ? ` Attendee earned +${xpAwarded} XP` : ""
          }`,
      ticket: {
        id: ticketPass.id,
        code: ticketPass.code,
        status: alreadyCheckedIn ? "checked_in" : "checked_in",
        guestName: ticketPass.guest_name || undefined,
        ticketType: ticketType?.name || undefined,
        eventName: event.name,
        alreadyCheckedIn,
        checkedInAt: ticketPass.checked_in_at || new Date().toISOString(),
      },
      xpAwarded: alreadyCheckedIn ? 0 : xpAwarded,
    });
  } catch (error) {
    console.error("Ticket verification error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * GET: Check ticket status without modifying
 * Used for previewing ticket info before check-in
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Code parameter required" },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase();

    // Get authenticated user
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

    const normalizedCode = code.toUpperCase().trim();

    // Fetch ticket pass
    const { data: ticketPass, error } = await supabase
      .from("ticket_passes")
      .select(
        `
        id,
        code,
        status,
        guest_name,
        checked_in_at,
        event_id,
        events!inner(
          id,
          name,
          organizer_id,
          start_time
        ),
        ticket_types(name)
      `,
      )
      .eq("code", normalizedCode)
      .single();

    if (error || !ticketPass) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 },
      );
    }

    const event = ticketPass.events as {
      id: number;
      name: string;
      organizer_id: string;
      start_time: string;
    };
    const ticketType = ticketPass.ticket_types as { name: string } | null;

    // Verify organizer owns this event
    if (event.organizer_id !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const isAdmin =
        profile?.role === "admin" || profile?.role === "super_admin";

      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Not authorized for this event" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticketPass.id,
        code: ticketPass.code,
        status: ticketPass.status,
        guestName: ticketPass.guest_name,
        ticketType: ticketType?.name,
        eventName: event.name,
        eventTime: event.start_time,
        checkedIn: ticketPass.status === "checked_in",
        checkedInAt: ticketPass.checked_in_at,
      },
    });
  } catch (error) {
    console.error("Ticket lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
