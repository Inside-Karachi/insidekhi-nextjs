import { createServerSupabase } from "@/lib/supabase/server";

const STAFF_ROLES = new Set(["admin", "super_admin", "lister"]);

export class ListingRouteAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "ListingRouteAccessError";
    this.status = status;
  }
}

export interface ListingRouteAccessContext {
  userId: string;
  effectiveRole: string;
  isStaff: boolean;
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  adminSupabase: Awaited<ReturnType<typeof createServerSupabase>>;
}

export async function getListingRouteAccessContext(): Promise<ListingRouteAccessContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new ListingRouteAccessError("Unauthorized", 401);
  }

  const adminSupabase = await createServerSupabase({ useServiceRole: true });
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("role, active_role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new ListingRouteAccessError("Profile not found", 404);
  }

  const effectiveRole = profile.active_role || profile.role;

  return {
    userId: user.id,
    effectiveRole,
    isStaff: STAFF_ROLES.has(effectiveRole),
    supabase,
    adminSupabase,
  };
}

export async function assertListingRouteAccess(options: {
  listingId: number;
  allowBusinessOwner?: boolean;
}): Promise<ListingRouteAccessContext> {
  const { listingId, allowBusinessOwner = false } = options;
  const context = await getListingRouteAccessContext();

  if (context.isStaff) {
    return context;
  }

  if (!allowBusinessOwner || context.effectiveRole !== "business_owner") {
    throw new ListingRouteAccessError("Access denied", 403);
  }

  const { data: listing, error: listingError } = await context.adminSupabase
    .from("listings")
    .select("owner_id, created_by")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new ListingRouteAccessError("Listing not found", 404);
  }

  const isOwner =
    listing.owner_id === context.userId || listing.created_by === context.userId;

  if (!isOwner) {
    throw new ListingRouteAccessError("You can only manage your own listings", 403);
  }

  return context;
}

export function toListingAccessResponse(error: unknown) {
  if (error instanceof ListingRouteAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "Internal server error" }, { status: 500 });
}
