export type PostStatusDisplay =
  | "draft"
  | "pending_approval"
  | "published"
  | "rejected"
  | string;

export function getPostStatusLabel(status: PostStatusDisplay): string {
  switch (status) {
    case "pending_approval":
      return "Under Review";
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "rejected":
      return "Needs Changes";
    default:
      return status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}
