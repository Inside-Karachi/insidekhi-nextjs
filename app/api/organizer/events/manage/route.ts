import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  EventFormData,
  SubmitEventChangeResponse,
  OrganizerManagedEvent,
} from "@/types/event-change-request.types";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

// Type alias for the event_change_requests table row
type EventChangeRequestRow =
  Database["public"]["Tables"]["event_change_requests"]["Row"];

// =============================================================================
// GET - Get organizer's managed events with pending change status
// =============================================================================
export async function GET(_request: NextRequest) {
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

    // Verify user has organizer role or higher
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

    if (
      !["organizer", "lister", "admin", "super_admin"].includes(profile.role)
    ) {
      return NextResponse.json(
        { success: false, error: "Organizer access required" },
        { status: 403 }
      );
    }

    // Use RPC to get managed events with pending status
    const { data: events, error: eventsError } = await supabase.rpc(
      "get_organizer_managed_events",
      { p_user_id: user.id }
    );

    if (eventsError) {
      console.error("Error fetching organizer events:", eventsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    // Also fetch pending create requests (no event_id yet)
    const { data: pendingCreates, error: pendingError } = await supabase
      .from("event_change_requests")
      .select("*")
      .eq("organizer_id", user.id)
      .eq("action_type", "create")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (pendingError) {
      console.error("Error fetching pending creates:", pendingError);
    }

    // Fetch rejected change requests so organizer can edit and resubmit
    const { data: rejectedRequests, error: rejectedError } = await supabase
      .from("event_change_requests")
      .select("*")
      .eq("organizer_id", user.id)
      .eq("status", "rejected")
      .order("updated_at", { ascending: false });

    if (rejectedError) {
      console.error("Error fetching rejected requests:", rejectedError);
    }

    return NextResponse.json({
      success: true,
      data: {
        events: (events as OrganizerManagedEvent[]) || [],
        pendingCreates: pendingCreates || [],
        rejectedRequests: rejectedRequests || [],
      },
    });
  } catch (error) {
    console.error("Error in organizer events GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Submit event change request (create/update/delete)
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

    // Verify user has organizer role or higher
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

    if (
      !["organizer", "lister", "admin", "super_admin"].includes(profile.role)
    ) {
      return NextResponse.json(
        { success: false, error: "Organizer access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      action_type,
      event_id,
      event_data,
    }: {
      action_type: "create" | "update" | "delete";
      event_id?: number;
      event_data?: EventFormData;
    } = body;

    // Validate action type
    if (!["create", "update", "delete"].includes(action_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid action type" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (action_type === "create" && !event_data) {
      return NextResponse.json(
        { success: false, error: "Event data required for create action" },
        { status: 400 }
      );
    }

    if (action_type !== "create" && !event_id) {
      return NextResponse.json(
        { success: false, error: "Event ID required for update/delete action" },
        { status: 400 }
      );
    }

    if (action_type === "update" && !event_data) {
      return NextResponse.json(
        { success: false, error: "Event data required for update action" },
        { status: 400 }
      );
    }

    // Use RPC to submit the change request
    const { data: result, error: rpcError } = await supabase.rpc(
      "submit_event_change_request",
      {
        p_action_type: action_type,
        p_event_id: event_id,
        p_proposed_data: event_data
          ? JSON.parse(JSON.stringify(event_data))
          : undefined,
      }
    );

    if (rpcError) {
      console.error("Error submitting change request:", rpcError);
      return NextResponse.json(
        { success: false, error: "Failed to submit change request" },
        { status: 500 }
      );
    }

    const response = result as unknown as SubmitEventChangeResponse;

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        request_id: response.request_id,
        event_id: response.event_id,
        message: response.message,
        requires_approval: response.requires_approval,
      },
    });
  } catch (error) {
    console.error("Error in organizer events POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Cancel a pending change request
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("request_id");

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Request ID is required" },
        { status: 400 }
      );
    }

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

    // Check if the request exists and belongs to this user
    const { data: changeRequest, error: fetchError } = await supabase
      .from("event_change_requests")
      .select("*")
      .eq("id", parseInt(requestId, 10))
      .single();

    if (fetchError || !changeRequest) {
      return NextResponse.json(
        { success: false, error: "Change request not found" },
        { status: 404 }
      );
    }

    // Use properly typed request
    const typedRequest: EventChangeRequestRow = changeRequest;

    // Only allow cancellation of own pending or rejected requests
    if (typedRequest.organizer_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "You can only cancel your own requests" },
        { status: 403 }
      );
    }

    // Allow deleting pending or rejected requests (not approved ones)
    if (
      typedRequest.status !== "pending" &&
      typedRequest.status !== "rejected"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Only pending or rejected requests can be cancelled",
        },
        { status: 400 }
      );
    }

    // Delete the request
    const { error: deleteError } = await supabase
      .from("event_change_requests")
      .delete()
      .eq("id", parseInt(requestId, 10));

    if (deleteError) {
      console.error("Error deleting change request:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to cancel request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Change request cancelled successfully",
    });
  } catch (error) {
    console.error("Error in organizer events DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
