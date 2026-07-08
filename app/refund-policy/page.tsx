import type { Metadata } from "next";
import {
  RefundPolicyHero,
  RefundPolicyContent,
  RefundPolicyContact,
} from "@/components/refund-policy";

export const metadata: Metadata = {
  title: "Refund Policy - Inside Karachi",
  description:
    "Learn about our refund policy for event tickets, digital services, and purchases made through Inside Karachi platform.",
  keywords: "refund policy, event tickets, Karachi, Pakistan, digital services",
  openGraph: {
    title: "Refund Policy - Inside Karachi",
    description:
      "Transparent refund policy for all services and purchases on Inside Karachi.",
    type: "website",
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <RefundPolicyHero />
      <RefundPolicyContent />
      <RefundPolicyContact />
    </div>
  );
}
