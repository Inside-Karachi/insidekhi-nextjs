import type { Metadata } from "next";
import {
  TermsAndConditionsHero,
  TermsAndConditionsContent,
  TermsAndConditionsContact,
} from "@/components/terms-and-conditions";

export const metadata: Metadata = {
  title: "Terms & Conditions - Inside Karachi | Legal Terms of Service",
  description:
    "Read Inside Karachi's Terms & Conditions governing platform usage, user responsibilities, payments, and legal rights. Comprehensive terms of service for digital services and platform access.",
  keywords: [
    "terms and conditions",
    "terms of service",
    "user agreement",
    "legal terms",
    "platform usage",
    "Karachi",
    "Pakistan",
  ],
  openGraph: {
    title: "Terms & Conditions - Inside Karachi",
    description:
      "Understand your rights and responsibilities when using Inside Karachi's platform and services.",
    type: "website",
  },
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TermsAndConditionsHero />
      <TermsAndConditionsContent />
      <TermsAndConditionsContact />
    </div>
  );
}
