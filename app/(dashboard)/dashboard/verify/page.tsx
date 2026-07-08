import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Redirect to unified scan page
export default function VerifyPage() {
  redirect("/dashboard/scan");
}
