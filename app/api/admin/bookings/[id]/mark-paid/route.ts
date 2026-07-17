import { createServerSupabase } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/service";
import crypto from "crypto";

/**
 * Admin API: Mark Booking as Paid
 *
 * Uses atomic RPC function when available, falls back to service role operations.
 * Only super_admin can use this endpoint.
 *
 * ATOMIC OPERATION: Uses PostgreSQL transaction via RPC for consistency.
 * If ticket generation fails, booking status is rolled back.
 */

// RPC response type
interface MarkBookingPaidRpcResponse {
  success: boolean;
  message?: string;
  error?: string;
  passes_created?: number;
}

// Generate ticket codes for a booking (fallback)
function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "IK-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate HMAC signature for ticket (fallback)
function generateSignature(
  code: string,
  eventId: number,
  bookingId: number,
): string {
  const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
  if (!SIGNING_SECRET) {
    throw new Error(
      "TICKET_SIGNING_SECRET environment variable is not configured",
    );
  }
  const payload = `${code}:${eventId}:${bookingId}`;
  return crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex")
    .substring(0, 16);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid booking ID" },
        { status: 400 },
      );
    }

    // Use regular client for auth check    // Check user is authenticated and is super_admin
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Check super_admin role (only super_admin can mark as paid manually)
    const supabase = await createServerSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Super admin access required" },
        { status: 403 },
      );
    }

    // Use service role client for operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Try to use the atomic RPC function first (preferred)
    // Call via direct REST API to avoid TypeScript RPC type constraints
    const signingSecret = process.env.TICKET_SIGNING_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      try {
        const rpcResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/admin_mark_booking_paid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              p_booking_id: bookingId,
              p_admin_id: session.userId,
              p_signing_secret: signingSecret,
            }),
          },
        );

        if (rpcResponse.ok) {
          const rpcResult: MarkBookingPaidRpcResponse =
            await rpcResponse.json();

          if (rpcResult.success) {
            // === SEND NOTIFICATION: Payment Success (RPC Path) ===
            try {
              // Fetch booking details for notification
              const { data: bookingData, error: bookingFetchError } =
                await adminSupabase
                  .from("bookings")
                  .select(
                    `
                  user_id, 
                  booking_reference,
                  event:events(name)
                `,
                  )
                  .eq("id", bookingId)
                  .single();

              if (bookingFetchError) {
                console.error(
                  "[RPC PATH] Failed to fetch booking data:",
                  bookingFetchError,
                );
                throw bookingFetchError;
              }

              if (!bookingData) {
                console.error("[RPC PATH] Booking data is null");
                throw new Error("Booking data not found");
              }

              console.log("[RPC PATH] Booking data:", {
                user_id: bookingData.user_id,
                has_event: !!bookingData.event,
                event: bookingData.event,
              });

              if (!bookingData.user_id) {
                console.error("[RPC PATH] No user_id in booking");
                throw new Error("Booking has no user_id");
              }

              if (!bookingData.event) {
                console.error("[RPC PATH] No event data");
                throw new Error("Event data not found");
              }

              const passesCreated = rpcResult.passes_created || 0;
              const eventName = bookingData.event.name;

              console.log("[RPC PATH] Creating notification:", {
                recipientId: bookingData.user_id,
                eventName,
                passesCreated,
              });

              const notificationResult = await createNotification(
                {
                  recipientId: bookingData.user_id,
                  roleScope: "public_user",
                  categorySlug: "public_booking_confirmation",
                  title: "🎉 Payment Confirmed!",
                  body: `Your tickets for ${eventName} are ready. ${passesCreated} pass${
                    passesCreated !== 1 ? "es" : ""
                  } issued.`,
                  priority: "high",
                  ctaLabel: "View My Tickets",
                  ctaUrl: `/dashboard/bookings`,
                  metadata: {
                    booking_id: bookingId,
                    booking_reference: bookingData.booking_reference,
                    event_name: eventName,
                    passes_count: passesCreated,
                  },
                  channelOverrides: {
                    bell: true,
                    email: true,
                    push: false,
                  },
                },
                { supabase: adminSupabase },
              );

              console.log("[RPC PATH] Notification created:", {
                notification_id: notificationResult.notification.id,
                channels: notificationResult.channels.length,
                outbox: notificationResult.outbox.length,
              });

              console.log(
                `[RPC PATH] Notification sent for booking ${bookingId} to user ${bookingData.user_id}`,
              );

              // Trigger email dispatch if there are outbox items
              if (notificationResult.outbox.length > 0) {
                try {
                  console.log("[RPC PATH] Triggering email dispatch...");
                  const dispatchModule =
                    await import("@/lib/notifications/dispatcher");
                  const dispatchResult =
                    await dispatchModule.dispatchEmailOutboxBatch({
                      supabase: adminSupabase,
                      limit: 10,
                    });
                  console.log("[RPC PATH] Email dispatch result:", {
                    sent: dispatchResult.sent,
                    failed: dispatchResult.failed,
                  });
                } catch (dispatchError) {
                  console.error(
                    "[RPC PATH] Email dispatch failed:",
                    dispatchError,
                  );
                }
              }
            } catch (notifError) {
              console.error(
                "[RPC PATH] Failed to send notification:",
                notifError,
              );
              console.error("[RPC PATH] Error stack:", notifError);
              // Re-throw to see the error in response (during testing)
              if (process.env.NEXT_DEBUG === "TRUE") {
                throw notifError;
              }
            }

            return NextResponse.json({
              success: true,
              message: rpcResult.message,
              passesCreated: rpcResult.passes_created || 0,
            });
          } else {
            return NextResponse.json(
              { success: false, error: rpcResult.error || "Operation failed" },
              { status: 400 },
            );
          }
        }

        // RPC doesn't exist (404) or other error - fall through to fallback
        if (rpcResponse.status !== 404) {
          const errorText = await rpcResponse.text();
          console.log("RPC call failed:", rpcResponse.status, errorText);
        }
      } catch (rpcErr) {
        console.log("RPC call exception, using fallback:", rpcErr);
      }
    }

    // Fallback to manual implementation if RPC doesn't exist
    console.log("Using fallback implementation (RPC not available)");

    // Get booking with service role
    const { data: booking, error: bookingError } = await adminSupabase
      .from("bookings")
      .select("id, event_id, payment_status, status, customer_name, user_id")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking fetch error:", bookingError);
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }

    // Check if already paid
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { success: false, error: "Booking is already paid" },
        { status: 400 },
      );
    }

    // Get booking items
    const { data: bookingItems, error: itemsError } = await adminSupabase
      .from("booking_items")
      .select("booking_id, quantity, ticket_type_id")
      .eq("booking_id", bookingId);

    if (itemsError) {
      console.error("Booking items fetch error:", itemsError);
    }

    // Check if we need to generate ticket passes
    const eventId = booking.event_id;
    const needsTickets = eventId && bookingItems && bookingItems.length > 0;

    // Prepare ticket passes if needed
    const passesToCreate: Array<{
      booking_id: number;
      event_id: number;
      ticket_type_id: number;
      code: string;
      signature: string;
      guest_name: string;
      status: "issued";
      quantity_index: number;
    }> = [];

    if (needsTickets) {
      for (const item of bookingItems) {
        for (let i = 0; i < item.quantity; i++) {
          const code = generateTicketCode();
          const signature = generateSignature(code, eventId, bookingId);
          const guestName = booking.customer_name || `Guest ${i + 1}`;

          passesToCreate.push({
            booking_id: bookingId,
            event_id: eventId,
            ticket_type_id: item.ticket_type_id,
            code,
            signature,
            guest_name: guestName,
            status: "issued",
            quantity_index: i + 1,
          });
        }
      }
    }

    // === ATOMIC OPERATION: Update booking and create passes ===
    // First update the booking status
    const { error: updateError } = await adminSupabase
      .from("bookings")
      .update({
        payment_status: "paid",
        status: "confirmed",
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Failed to update booking:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update booking: " + updateError.message,
        },
        { status: 500 },
      );
    }

    // Create ticket passes if needed
    let passesCreated = 0;
    if (passesToCreate.length > 0) {
      const { data: createdPasses, error: passError } = await adminSupabase
        .from("ticket_passes")
        .insert(passesToCreate)
        .select("id");

      if (passError) {
        console.error("Failed to create ticket passes:", passError);
        // ROLLBACK: Revert the booking status since passes failed
        await adminSupabase
          .from("bookings")
          .update({
            payment_status: "awaiting_payment",
            status: "pending",
          })
          .eq("id", bookingId);

        return NextResponse.json(
          {
            success: false,
            error: "Failed to generate tickets. Booking status reverted.",
          },
          { status: 500 },
        );
      }

      passesCreated = createdPasses?.length || passesToCreate.length;
    }

    // Record in booking status history if table exists
    // Note: booking_status_history uses booking_payment_status_enum, not booking_status
    try {
      await adminSupabase.from("booking_status_history").insert({
        booking_id: bookingId,
        old_status: booking.payment_status, // Use payment_status, not status
        new_status: "paid" as const, // This is booking_payment_status_enum
        context: `Manually marked as paid by admin ${session.userId}. ${passesCreated} tickets generated.`,
      });
    } catch {
      // Ignore if history table doesn't exist or insert fails
    }

    // === SEND NOTIFICATION: Payment Success ===
    if (booking.user_id) {
      try {
        // Fetch full booking details for notification
        const { data: fullBooking } = await adminSupabase
          .from("bookings")
          .select(
            `
            id,
            booking_reference,
            customer_name,
            customer_email,
            total_amount,
            event:events (
              id,
              name,
              slug,
              start_time
            )
          `,
          )
          .eq("id", bookingId)
          .single();

        if (fullBooking && fullBooking.event) {
          const eventName = fullBooking.event.name;

          // Create in-app notification
          await createNotification(
            {
              recipientId: booking.user_id,
              roleScope: "public_user",
              categorySlug: "public_booking_confirmation",
              title: "🎉 Payment Confirmed!",
              body: `Your tickets for ${eventName} are ready. ${passesCreated} pass${
                passesCreated !== 1 ? "es" : ""
              } issued.`,
              priority: "high",
              ctaLabel: "View My Tickets",
              ctaUrl: `/dashboard/bookings`,
              metadata: {
                booking_id: bookingId,
                booking_reference: fullBooking.booking_reference,
                event_name: eventName,
                passes_count: passesCreated,
              },
              channelOverrides: {
                bell: true,
                email: true, // Will send email via dispatcher
                push: false,
              },
            },
            { supabase: adminSupabase },
          );

          console.log(
            `Notification sent for booking ${bookingId} to user ${booking.user_id}`,
          );
        }
      } catch (notifError) {
        // Don't fail the whole operation if notification fails
        console.error("Failed to send notification:", notifError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Booking marked as paid. ${passesCreated} ticket passes generated.`,
      passesCreated,
    });
  } catch (error) {
    console.error("Mark paid error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
