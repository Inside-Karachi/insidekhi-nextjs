import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// This page redirects to the main dashboard
// Organizers now see their dashboard at /dashboard directly
export default function OrganizerDashboardPage() {
  redirect("/dashboard");
}
