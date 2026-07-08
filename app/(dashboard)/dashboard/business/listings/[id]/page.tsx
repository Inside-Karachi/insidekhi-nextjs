import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BusinessListingEditor from "@/components/business-owner/BusinessListingEditor";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditListingPage({ params }: PageProps) {
  const { id } = await params;
  const listingId = parseInt(id, 10);

  if (isNaN(listingId)) {
    redirect("/dashboard/business/listings");
  }

  const supabase = await createServerSupabase();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile to check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active_role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/dashboard");
  }

  const effectiveRole = profile.active_role || profile.role;

  if (
    effectiveRole !== "business_owner" &&
    effectiveRole !== "admin" &&
    effectiveRole !== "super_admin"
  ) {
    redirect("/dashboard");
  }

  // Fetch listing with full details
  const { data: listing, error } = await supabase
    .from("listings")
    .select(
      `
      *,
      category:categories(id, name),
      branches:listing_branches(*),
      images:listing_images!listing_id(*)
    `,
    )
    .eq("id", listingId)
    .single();

  if (error || !listing) {
    redirect("/dashboard/business/listings");
  }

  // Verify ownership
  if (
    listing.owner_id !== user.id &&
    listing.created_by !== user.id &&
    effectiveRole !== "admin" &&
    effectiveRole !== "super_admin"
  ) {
    redirect("/dashboard/business/listings");
  }

  return (
    <div className="w-full">
      <BusinessListingEditor listing={listing} mode="edit" />
    </div>
  );
}
