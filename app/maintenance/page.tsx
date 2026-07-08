import { MaintenancePage } from "@/components/maintenance/MaintenancePage";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Maintenance() {
  // Use service role to bypass RLS on system_config table
  // This is safe because maintenance page is public and we're only reading system configuration
  const supabase = await createServerSupabase({ useServiceRole: true });

  // Fetch maintenance configuration
  const { data: configs } = await supabase
    .from("system_config")
    .select("config_key, config_value")
    .in("config_key", [
      "maintenance.enabled",
      "maintenance.message",
      "maintenance.estimated_end",
    ]);

  // Check if maintenance mode is enabled
  const enabledConfig = configs?.find(
    (c) => c.config_key === "maintenance.enabled"
  );
  const configValue = enabledConfig?.config_value;
  const enabled =
    configValue === true ||
    configValue === "true" ||
    (typeof configValue === "string" && configValue.toLowerCase() === "true");

  // If maintenance mode is disabled, redirect to home
  if (!enabled) {
    redirect("/");
  }

  const message =
    configs?.find((c) => c.config_key === "maintenance.message")
      ?.config_value ||
    "We are performing scheduled maintenance. We'll be back shortly!";

  const estimatedEndConfig = configs?.find(
    (c) => c.config_key === "maintenance.estimated_end"
  );

  const estimatedEnd = estimatedEndConfig?.config_value;

  const cleanEstimatedEnd =
    estimatedEnd && estimatedEnd !== null && estimatedEnd !== "null"
      ? String(estimatedEnd).replace(/^"|"$/g, "")
      : null;

  return (
    <MaintenancePage
      message={String(message).replace(/^"|"$/g, "")} // Remove JSON string quotes
      estimatedEnd={cleanEstimatedEnd}
    />
  );
}

export const metadata = {
  title: "Under Maintenance | Inside Karachi",
  description:
    "We are performing scheduled maintenance. We'll be back shortly!",
};
