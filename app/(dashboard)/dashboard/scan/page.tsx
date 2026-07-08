import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import dynamicImport from "next/dynamic";

const UnifiedScannerClient = dynamicImport(
  () =>
    import("@/components/events/UnifiedScannerClient").then(
      (mod) => mod.UnifiedScannerClient
    ),
  {
    loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted/40" />,
  }
);

export const dynamic = "force-dynamic";

export const metadata = {
  title: "QR Scanner | Inside Karachi",
  description:
    "Scan QR codes to verify tickets or earn XP at partner locations",
};

export default async function ScanPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/scan");
  }

  // Get user profile and role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active_role")
    .eq("id", user.id)
    .single();

  // Respect role switching - use active_role if set
  const currentRole = profile?.active_role || profile?.role || "public_user";
  const isAdmin = currentRole === "admin" || currentRole === "super_admin";
  const isOrganizerRole = currentRole === "organizer";

  // Check if user organizes any events (even without organizer role)
  const { data: organizerEvents } = await supabase
    .from("events")
    .select("id")
    .eq("organizer_id", user.id)
    .limit(1);

  const hasEvents = organizerEvents && organizerEvents.length > 0;
  const isOrganizer = isOrganizerRole || hasEvents || isAdmin;

  return (
    <UnifiedScannerClient
      isOrganizer={isOrganizer}
      isAdmin={isAdmin}
      userRole={currentRole}
    />
  );
}
