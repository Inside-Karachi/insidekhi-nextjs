import { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrganizerEventsPage } from "@/components/dashboard/OrganizerEventsPage";
import { Calendar } from "lucide-react";
import { requireSessionUser } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "My Events | Inside Karachi",
  description: "Manage your events on Inside Karachi",
};

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/dashboard");
  }

  // Check active_role to respect role switching
  const currentRole =
    (profile.active_role as string | null | undefined) ||
    (profile.role as string | null | undefined) ||
    "";
  const allowedRoles = ["organizer", "lister", "admin", "super_admin"];
  if (!allowedRoles.includes(currentRole)) {
    redirect("/dashboard");
  }

  return (
    <div className="container py-6 space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              My Events
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Create, manage, and track your events. All changes are submitted for
            review.
          </p>
        </div>
      </div>

      <OrganizerEventsPage />
    </div>
  );
}
