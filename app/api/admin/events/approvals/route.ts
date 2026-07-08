import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  EventChangeRequestWithDetails,
  ProcessEventChangeResponse,
} from "@/types/event-change-request.types";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

// Type aliases for enums
type EventChangeStatus = Database["public"]["Enums"]["event_change_status"];
type EventChangeAction = Database["public"]["Enums"]["event_change_action"];

// =============================================================================
// GET - Get event change requests for admin approval
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "pending";
    const action_type = searchParams.get("action_type");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

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

    // Verify user has admin/lister role
    const { data: profile, error: profileError } = await supabase
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

    if (!["lister", "admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Build query for change requests with details
    let query = supabase
      .from("event_change_requests_with_details")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status as EventChangeStatus);
    }

    if (action_type && action_type !== "all") {
      query = query.eq("action_type", action_type as EventChangeAction);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: requests, error, count } = await query;

    if (error) {
      console.error("Error fetching change requests:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch change requests" },
        { status: 500 }
      );
    }

    // Get stats counts
    const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
      supabase
        .from("event_change_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("event_change_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase
        .from("event_change_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        requests: (requests as EventChangeRequestWithDetails[]) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        pendingCount: pendingResult.count || 0,
        approvedCount: approvedResult.count || 0,
        rejectedCount: rejectedResult.count || 0,
      },
    });
  } catch (error) {
    console.error("Error in event approvals GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Process (approve/reject) an event change request
// =============================================================================
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
        { status: 401 }
      );
    }

    // Verify user has admin/lister role
    const { data: profile, error: profileError } = await supabase
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

    if (!["lister", "admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      request_id,
      action,
      review_notes,
    }: {
      request_id: number;
      action: "approve" | "reject";
      review_notes?: string;
    } = body;

    // Validate required fields
    if (!request_id) {
      return NextResponse.json(
        { success: false, error: "Request ID is required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be approve or reject" },
        { status: 400 }
      );
    }

    // Rejection requires notes
    if (action === "reject" && !review_notes?.trim()) {
      return NextResponse.json(
        { success: false, error: "Review notes are required for rejection" },
        { status: 400 }
      );
    }

    // Use RPC to process the request
    const { data: result, error: rpcError } = await supabase.rpc(
      "process_event_change_request",
      {
        p_request_id: request_id,
        p_action: action,
        p_review_notes: review_notes || undefined,
      }
    );

    if (rpcError) {
      console.error("Error processing change request:", rpcError);
      return NextResponse.json(
        { success: false, error: "Failed to process change request" },
        { status: 500 }
      );
    }

    const response = result as unknown as ProcessEventChangeResponse;

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: 400 }
      );
    }

    // Fetch the change request details to log what changed and handle temp images
    let changeRequestDetails: Record<string, unknown> | null = null;
    let proposedData: Record<string, unknown> | null = null;
    try {
      const { data: requestData } = await supabase
        .from("event_change_requests")
        .select("action_type, proposed_data, original_data, organizer_id")
        .eq("id", request_id)
        .single();

      if (requestData) {
        changeRequestDetails = {
          action_type: requestData.action_type,
          organizer_id: requestData.organizer_id,
        };
        proposedData = requestData.proposed_data as Record<
          string,
          unknown
        > | null;
      }
    } catch {
      // Continue even if fetch fails
    }

    // If approved and there are temp images, migrate them to permanent storage
    if (
      action === "approve" &&
      response.event_id &&
      proposedData?.temp_images
    ) {
      try {
        const tempImages = proposedData.temp_images as Array<{
          url: string;
          alt_text?: string;
          is_primary?: boolean;
          display_order?: number;
        }>;
        const tempSessionId = proposedData.temp_session_id as
          | string
          | undefined;

        if (tempImages.length > 0 && tempSessionId) {
          // Use admin supabase for storage operations
          const { createServerSupabase: createAdminSupabase } = await import(
            "@/lib/supabase/server"
          );
          const adminSupabase = await createAdminSupabase({
            useServiceRole: true,
          });

          // Move each temp image to permanent location and create event_images records
          for (let i = 0; i < tempImages.length; i++) {
            const img = tempImages[i];
            const tempPath = img.url.split("/event-images/")[1];

            if (tempPath && tempPath.startsWith("temp/")) {
              // Generate new permanent path
              const filename = tempPath.split("/").pop();
              const permanentPath = `events/${response.event_id}/${filename}`;

              // Move file in storage
              const { error: moveError } = await adminSupabase.storage
                .from("event-images")
                .move(tempPath, permanentPath);

              if (!moveError) {
                // Get the new URL
                const newUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${permanentPath}`;

                // Create event_images record
                await supabase.from("event_images").insert({
                  event_id: response.event_id,
                  url: newUrl,
                  alt_text: img.alt_text || "",
                  is_primary: img.is_primary || i === 0,
                  display_order: img.display_order ?? i,
                });
              } else {
                console.error("Error moving temp image:", moveError);
              }
            }
          }
        }
      } catch (imageError) {
        console.error("Error migrating temp images:", imageError);
        // Don't fail the approval if image migration fails
      }
    }

    // If approved and there are proposed ticket types, handle them (create/update/delete)
    if (
      action === "approve" &&
      response.event_id &&
      proposedData?.temp_tickets
    ) {
      try {
        const tempTickets = proposedData.temp_tickets as Array<{
          id?: number;
          name: string;
          description?: string | null;
          price: number;
          quantity_available: number | null;
          sale_starts_at: string;
          sale_ends_at: string;
          max_per_person?: number;
        }>;

        if (tempTickets.length > 0) {
          console.log(
            `Processing ${tempTickets.length} tickets for event ${response.event_id}`
          );
          console.log(
            "[PROPOSED TICKETS DATA]:",
            JSON.stringify(tempTickets, null, 2)
          );

          // 1. Get existing tickets to identify deletions
          const { data: existingTickets } = await supabase
            .from("ticket_types")
            .select("id")
            .eq("event_id", response.event_id);

          const existingIds = new Set(existingTickets?.map((t) => t.id) || []);
          const proposedIds = new Set(
            tempTickets.map((t) => t.id).filter((id): id is number => !!id)
          );

          // 2. Delete tickets that are not in the proposed list
          // (Only if it's an update request - for create, existingIds is empty)
          const idsToDelete = [...existingIds].filter(
            (id) => !proposedIds.has(id)
          );

          for (const id of idsToDelete) {
            // Check for bookings first
            const { count: bookingCount } = await supabase
              .from("booking_items")
              .select("*", { count: "exact", head: true })
              .eq("ticket_type_id", id);

            if (!bookingCount || bookingCount === 0) {
              await supabase.from("ticket_types").delete().eq("id", id);
              console.log(`Deleted ticket ${id}`);
            } else {
              console.warn(
                `Skipping deletion of ticket ${id} due to existing bookings`
              );
            }
          }

          // 3. Upsert (Update existing or Insert new)
          for (const ticket of tempTickets) {
            const ticketData = {
              event_id: response.event_id,
              name: ticket.name,
              description: ticket.description || null,
              price: ticket.price,
              quantity_available: ticket.quantity_available,
              sale_starts_at: ticket.sale_starts_at,
              sale_ends_at: ticket.sale_ends_at,
              max_per_person: ticket.max_per_person || 10,
            };

            if (ticket.id) {
              // Update existing
              console.log(`[TICKET UPDATE] Ticket ID ${ticket.id}:`, {
                name: ticket.name,
                description: ticket.description,
                ticketData_description: ticketData.description,
              });

              const { error: updateError } = await supabase
                .from("ticket_types")
                .update(ticketData)
                .eq("id", ticket.id);

              if (updateError) {
                console.error(
                  `Error updating ticket ${ticket.id}:`,
                  updateError
                );
              } else {
                console.log(
                  `Successfully updated ticket ${ticket.id} with description: ${ticketData.description}`
                );
              }
            } else {
              // Insert new
              console.log(`[TICKET INSERT] New ticket:`, {
                name: ticket.name,
                description: ticket.description,
                ticketData_description: ticketData.description,
              });

              const { error: insertError } = await supabase
                .from("ticket_types")
                .insert(ticketData);

              if (insertError) {
                console.error(
                  `Error inserting ticket "${ticket.name}":`,
                  insertError
                );
              } else {
                console.log(
                  `Created new ticket: ${ticket.name} with description: ${ticketData.description}`
                );
              }
            }
          }
        }
      } catch (ticketError) {
        console.error("Error processing ticket types:", ticketError);
        // Don't fail the approval if ticket processing fails
      }
    }

    // If rejected and there are temp images, clean them up
    if (action === "reject" && proposedData?.temp_images) {
      try {
        const tempImages = proposedData.temp_images as Array<{ url: string }>;
        const tempSessionId = proposedData.temp_session_id as
          | string
          | undefined;

        if (tempImages.length > 0 && tempSessionId) {
          const { createServerSupabase: createAdminSupabase } = await import(
            "@/lib/supabase/server"
          );
          const adminSupabase = await createAdminSupabase({
            useServiceRole: true,
          });

          // Delete the entire temp session folder
          const tempFolderPath = `temp/${tempSessionId}`;
          const { data: files } = await adminSupabase.storage
            .from("event-images")
            .list(tempFolderPath);

          if (files && files.length > 0) {
            const filePaths = files.map((f) => `${tempFolderPath}/${f.name}`);
            await adminSupabase.storage.from("event-images").remove(filePaths);
          }
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp images:", cleanupError);
        // Don't fail the rejection if cleanup fails
      }
    }

    // Log the admin action with detailed change information
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action:
          action === "approve"
            ? changeRequestDetails?.action_type === "delete"
              ? "event_deleted"
              : "event_updated"
            : "event_updated",
        entity_type: "event_change_request",
        entity_id: request_id.toString(),
        admin_id: user.id,
        old_values: changeRequestDetails
          ? {
              original_data:
                changeRequestDetails.action_type !== "create"
                  ? "See change request"
                  : null,
              action_type: changeRequestDetails.action_type,
            }
          : undefined,
        new_values: changeRequestDetails
          ? {
              proposed_data:
                changeRequestDetails.action_type !== "delete"
                  ? "Applied"
                  : null,
              decision: action,
              review_notes: review_notes || "No notes provided",
            }
          : undefined,
        metadata: {
          change_action: action,
          request_action_type: changeRequestDetails?.action_type,
          review_notes,
          event_id: response.event_id,
          organizer_id: changeRequestDetails?.organizer_id,
        },
        ip_address:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        user_agent: request.headers.get("user-agent") || undefined,
      });
    } catch (logError) {
      console.error("Failed to log action:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      data: {
        request_id: response.request_id,
        event_id: response.event_id,
        message: response.message,
      },
    });
  } catch (error) {
    console.error("Error in event approvals POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
