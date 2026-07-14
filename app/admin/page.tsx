import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";

// NOTE: Admin landing canonical is `/dashboard`. To avoid duplication and
// keep a single admin landing experience, we redirect `/admin` -> `/dashboard`.
// This preserves bookmarks but ensures the canonical dashboard view is served.
export default async function AdminPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  // If admin, redirect to canonical dashboard page
  redirect("/dashboard");
}
