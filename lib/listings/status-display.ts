export type ListingStatusDisplay =
  | "draft"
  | "pending_approval"
  | "published"
  | "rejected"
  | "archived"
  | string;

export function getListingStatusLabel(status: ListingStatusDisplay): string {
  switch (status) {
    case "pending_approval":
      return "Under Review";
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "rejected":
      return "Needs Changes";
    case "archived":
      return "Archived";
    default:
      return status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}
