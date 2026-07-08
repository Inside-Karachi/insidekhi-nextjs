import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CleanupLogsClient } from "@/components/admin/CleanupLogsClient";

export default async function CleanupLogsPage() {
  const supabase = await createServerSupabase();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check super admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    redirect("/admin");
  }

  // Fetch cleanup logs (using service role to bypass RLS)
  const adminSupabase = await createServerSupabase({ useServiceRole: true });

  const { data: logs, error } = await adminSupabase
    .from("form_reply_cleanup_logs" as never)
    .select(
      `
      *,
      deleted_by_profile:profiles!executed_by(full_name, email)
    `
    )
    .order("executed_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to fetch cleanup logs:", error);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Reply Cleanup Logs</h1>
        <p className="text-muted-foreground">
          Audit trail for automatic cleanup of soft-deleted form replies
        </p>
      </div>

      <CleanupLogsClient
        initialLogs={(logs as never) || []}
        userRole={profile?.role || "user"}
      />
    </div>
  );
}
