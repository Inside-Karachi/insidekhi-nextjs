import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { WriterApplyPage } from "@/components/writer/WriterApplyPage";

export const dynamic = "force-dynamic";

export default async function WriterApplyRoutePage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  const alreadyWriter =
    profile.role === "writer" ||
    profile.active_role === "writer" ||
    profile.role === "admin" ||
    profile.role === "super_admin";

  if (alreadyWriter) {
    redirect("/dashboard/writer");
  }

  return <WriterApplyPage />;
}
