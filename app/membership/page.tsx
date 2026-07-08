import { Metadata } from "next";
import { MembershipHero } from "@/components/membership/MembershipHero";
import { MembershipBenefits } from "@/components/membership/MembershipBenefits";
import { MembershipForm } from "@/components/membership/MembershipForm";
import { PremiumCTASection } from "@/components/membership/PremiumCTASection";

export const metadata: Metadata = {
  title: "Membership - Inside Karachi | Premium Business Growth",
  description:
    "Join Inside Karachi's exclusive membership program. Gain unprecedented exposure, access vital resources, and make meaningful connections in Karachi's business community.",
  keywords: [
    "Karachi membership",
    "business networking",
    "marketing opportunities",
    "lifestyle guide",
    "business growth",
  ],
  openGraph: {
    title: "Premium Membership - Inside Karachi",
    description:
      "Unlock exclusive benefits and grow your business with Inside Karachi's membership program.",
    type: "website",
  },
};

export default function MembershipPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero section */}
      <MembershipHero />

      {/* Benefits Grid */}
      <MembershipBenefits />

      {/* Membership Application Form */}
      <MembershipForm />

      {/* Final CTA Section */}
      <PremiumCTASection />
    </div>
  );
}
