import { Metadata } from "next";
import { GetListedHero } from "@/components/get-listed/GetListedHero";
import { GetListedBenefits } from "@/components/get-listed/GetListedBenefits";
import { GetListedForm } from "@/components/get-listed/GetListedForm";
import { BusinessCTASection } from "@/components/get-listed/BusinessCTASection";

export const metadata: Metadata = {
  title: "Get Listed - Inside Karachi | Grow Your Business",
  description:
    "List your business with Inside Karachi and join Karachi's premier directory. Increase visibility, attract customers, and grow your business in Pakistan's largest city.",
  keywords: [
    "business listing Karachi",
    "advertise business",
    "restaurant listing",
    "event listing",
    "business directory Pakistan",
  ],
  openGraph: {
    title: "Get Your Business Listed - Inside Karachi",
    description:
      "Promote your business and reach thousands of potential customers in Karachi.",
    type: "website",
  },
};

export default function GetListedPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero section */}
      <GetListedHero />

      {/* Benefits Section */}
      <GetListedBenefits />

      {/* Business Listing Form */}
      <GetListedForm />

      {/* Final CTA Section */}
      <BusinessCTASection />
    </div>
  );
}
