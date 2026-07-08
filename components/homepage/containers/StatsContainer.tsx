import { StatsAndSocialProofSection } from "@/components/homepage/StatsAndSocialProofSection";

export async function StatsContainer() {
  // Original code had Promise.resolve({ data: null })
  // If there is no real stats fetching logic yet, we return the section with null/default props.
  // The previous implementation was: Promise.resolve({ data: null }) as statsResult
  // const stats = statsResult?.data;

  // So we just render the component. It handles null stats internally (likely showing defaults or nothing).
  return <StatsAndSocialProofSection stats={null} />;
}
