import type { Metadata } from "next";
import {
  ServicePolicyHero,
  ServicePolicyContent,
  ServicePolicyContact,
} from "@/components/service-policy";

export const metadata: Metadata = {
  title: "Service Policy - Inside Karachi | Digital Service Terms",
  description:
    "Learn about Inside Karachi's service delivery, digital access, event ticketing, and customer responsibilities. Our comprehensive service policy for digital services and platform usage.",
  keywords: [
    "service policy",
    "digital services",
    "event tickets",
    "customer responsibilities",
    "service delivery",
    "Karachi",
    "Pakistan",
  ],
  openGraph: {
    title: "Service Policy - Inside Karachi",
    description:
      "Understand our service delivery terms, digital access policies, and customer responsibilities.",
    type: "website",
  },
};

export default function ServicePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <ServicePolicyHero />
      <ServicePolicyContent />
      <ServicePolicyContact />
    </div>
  );
}
