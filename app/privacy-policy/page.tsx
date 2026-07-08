import { Metadata } from "next";
import {
  PrivacyPolicyHero,
  PrivacyPolicyContent,
  PrivacyPolicyContact,
} from "@/components/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy - Inside Karachi | Your Data Protection",
  description:
    "Learn how Inside Karachi protects your privacy and handles your personal information. Our comprehensive privacy policy explains data collection, usage, and your rights.",
  keywords: [
    "privacy policy",
    "data protection",
    "GDPR compliance",
    "user privacy",
    "data security",
    "personal information",
  ],
  openGraph: {
    title: "Privacy Policy - Inside Karachi",
    description:
      "Your privacy matters to us. Learn how we protect and handle your personal data.",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero section */}
      <PrivacyPolicyHero />

      {/* Main Content Sections */}
      <PrivacyPolicyContent />

      {/* Contact Information */}
      <PrivacyPolicyContact />
    </div>
  );
}
