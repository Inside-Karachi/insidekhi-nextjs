import { redirect } from "next/navigation";
import { query } from "@/lib/db";
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

  // Fetch listing with full details
  const { rows: listingRows } = await query(
    `SELECT * FROM listings WHERE id = $1 LIMIT 1`,
    [listingId],
  );
  const listingRow = listingRows[0];

  if (!listingRow) {
    redirect("/dashboard/business/listings");
  }

  // Verify ownership
  if (
    listingRow.owner_id !== user.id &&
    listingRow.created_by !== user.id &&
    effectiveRole !== "admin" &&
    effectiveRole !== "super_admin"
  ) {
    redirect("/dashboard/business/listings");
  }

  const [categoryResult, branchesResult, imagesResult] = await Promise.all([
    listingRow.category_id
      ? query(`SELECT id, name FROM categories WHERE id = $1 LIMIT 1`, [
          listingRow.category_id,
        ])
      : Promise.resolve({ rows: [] }),
    query(`SELECT * FROM listing_branches WHERE listing_id = $1`, [
      listingId,
    ]),
    query(`SELECT * FROM listing_images WHERE listing_id = $1`, [listingId]),
  ]);

  const listing = {
    ...listingRow,
    category: categoryResult.rows[0] ?? null,
    branches: branchesResult.rows,
    images: imagesResult.rows,
  };

  return (
    <div className="w-full">
      <BusinessListingEditor listing={listing} mode="edit" />
    </div>
  );
}
