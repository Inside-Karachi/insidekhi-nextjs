import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { UserManagementPage } from "@/components/admin/UserManagementPage";

export default async function AdminUsersPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check admin access
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch admin role visibility config from system_config
  const { rows: visibleRolesRows } = await query(
    `SELECT config_value FROM system_config WHERE config_key = $1`,
    ["admin.visible_roles"],
  );
  const visibleRolesConfig = visibleRolesRows[0];

  const adminVisibleRoles: string[] = Array.isArray(
    visibleRolesConfig?.config_value,
  )
    ? (visibleRolesConfig.config_value as string[])
    : ["writer", "lister", "organizer", "data_entry"];

  return (
    <div className="space-y-8">
      {/* Header */}
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a1.5 1.5 0 01-1.5 1.5v-1.5a1.5 1.5 0 011.5-1.5zm-1.5 1.5H21v-1.5a1.5 1.5 0 011.5-1.5v1.5zM3.75 12.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              User Management
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage user accounts, roles, and permissions across the platform.
          </p>
        </div>
      </div>

      <UserManagementPage
        currentUserRole={profile.role}
        adminVisibleRoles={adminVisibleRoles}
      />
    </div>
  );
}
