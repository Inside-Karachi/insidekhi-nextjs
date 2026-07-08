import { Metadata } from "next";
import { ContactHero } from "@/components/contact/ContactHero";
import ContactForm from "@/components/contact/ContactForm";
import MapCard from "@/components/contact/MapCard";
import ContactInfo from "@/components/contact/ContactInfo";

export const metadata: Metadata = {
  title: "Contact Us - Inside Karachi | Get in Touch",
  description: "Contact Inside Karachi for inquiries, partnerships, advertising, or support. We're here to help bring your vision to life.",
  keywords: ["contact Inside Karachi", "business inquiry", "partnership", "support", "Karachi office"],
  openGraph: {
    title: "Contact Inside Karachi - Let's Connect",
    description: "Get in touch with the Inside Karachi team. We're here to help with your questions and collaboration opportunities.",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <ContactHero />
      
      {/* Interactive Map Section */}
      <MapCard />
      
      {/* Contact Form Section */}
      <ContactForm />
      
      {/* Contact Information Section */}
      <ContactInfo />
    </div>
  );
}
