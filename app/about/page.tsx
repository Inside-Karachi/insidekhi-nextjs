import { Metadata } from "next";
import AboutHero from "@/components/about/AboutHero";
import AboutBody from "@/components/about/AboutBody";

export const metadata: Metadata = {
  title: "About - Inside Karachi | Premium Directory & Community",
  description:
    "Inside Karachi is the premium business directory and lifestyle guide for Karachi — discover our mission, team, and the values that drive our platform.",
  openGraph: {
    title: "About Inside Karachi",
    description:
      "Learn about our mission to help Karachi businesses grow through premium exposure, tools, and a trusted local community.",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <AboutHero />

      {/* About page body (client) contains motion and interactive UI */}
      <AboutBody />

      {/* Body is rendered by client component */}
    </main>
  );
}
