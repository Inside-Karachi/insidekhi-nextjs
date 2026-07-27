import { MaintenancePage } from "@/components/maintenance/MaintenancePage";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function Maintenance() {
  // Fetch maintenance configuration
  const { rows: configs } = await query(
    `SELECT config_key, config_value FROM system_config
     WHERE config_key = ANY($1)`,
    [["maintenance.enabled", "maintenance.message", "maintenance.estimated_end"]],
  );

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
