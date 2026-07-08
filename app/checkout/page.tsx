import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure Checkout - Inside Karachi",
  description: "Complete your booking for tickets, events, and experiences securely.",
  robots: {
    index: false, // Don't index checkout pages
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 via-primary/5 to-transparent" />
        <div className="absolute -top-[200px] -right-[200px] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] opacity-40" />
        <div className="absolute top-[20%] -left-[200px] w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[100px] opacity-30" />
      </div>

      <div className="container max-w-7xl pt-12 pb-20 relative z-10">
        {/* Header Section */}
        <CheckoutHeader />

        {/* Main Content */}
        <CheckoutClient />
      </div>
    </div>
  );
}
