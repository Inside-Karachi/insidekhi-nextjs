import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { BlogCategoriesPage } from "@/components/admin/BlogCategoriesPage";

export const metadata: Metadata = {
  title: "Blog Categories | Admin | Inside Karachi",
  description: "Manage the blog/guides category taxonomy",
};

export const dynamic = "force-dynamic";

export default async function AdminBlogCategoriesPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/admin");
  }

  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role ?? "")) {
    redirect("/admin");
  }

  return <BlogCategoriesPage />;
}
