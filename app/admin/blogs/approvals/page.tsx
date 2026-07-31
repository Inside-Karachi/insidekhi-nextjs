import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { BlogApprovalsPage } from "@/components/admin/BlogApprovalsPage";

export const metadata: Metadata = {
  title: "Blog Approval Queue | Admin | Inside Karachi",
  description: "Review and approve writer blog submissions",
};

export const dynamic = "force-dynamic";

export default async function AdminBlogApprovalsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/admin");
  }

  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role ?? "")) {
    redirect("/admin");
  }

  return <BlogApprovalsPage />;
}
