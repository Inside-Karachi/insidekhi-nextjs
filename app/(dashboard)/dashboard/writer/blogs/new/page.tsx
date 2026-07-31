import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { WriterBlogEditor } from "@/components/writer/WriterBlogEditor";

export const dynamic = "force-dynamic";

export default async function NewWriterBlogPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  const canAccessWriter =
    profile.role === "writer" ||
    profile.active_role === "writer" ||
    profile.role === "admin" ||
    profile.role === "super_admin";

  if (!canAccessWriter) {
    redirect("/dashboard");
  }

  return <WriterBlogEditor mode="create" />;
}
