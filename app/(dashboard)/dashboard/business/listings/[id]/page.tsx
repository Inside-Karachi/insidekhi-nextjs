import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import BusinessListingEditor from "@/components/business-owner/BusinessListingEditor";
import { requireSessionUser } from "@/lib/auth/require-session";

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

  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/dashboard");
  }

  const effectiveRole =
    (profile.active_role as string | null | undefined) ||
    (profile.role as string | null | undefined);

  if (
    effectiveRole !== "business_owner" &&
    effectiveRole !== "admin" &&
    effectiveRole !== "super_admin"
  ) {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabase({ useServiceRole: true });

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
