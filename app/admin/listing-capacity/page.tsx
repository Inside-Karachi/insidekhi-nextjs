import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ListingCapacityPage } from "@/components/admin/ListingCapacityPage";

export default async function AdminListingCapacityPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister" &&
    profile.role !== "data_entry"
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Listing Capacity
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Fill minimum and maximum price per person and guest capacity for
            each listing.
          </p>
        </div>
      </div>

      <ListingCapacityPage />
    </div>
  );
}
