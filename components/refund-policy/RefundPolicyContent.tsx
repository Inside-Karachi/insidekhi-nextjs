"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Shield,
  Mail,
  FileText,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function RefundPolicyContent() {
  const sections = [
    {
      id: "general-policy",
      icon: Shield,
      title: "General Refund Policy",
      color: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-500",
      description:
        "Our general approach to refunds for digital services and information products.",
      subsections: [
        {
          title: "Digital Services",
          content:
            "Information services, business listings, and promotional content are generally non-refundable as they are delivered digitally upon purchase.",
        },
        {
          title: "Event Tickets",
          content:
            "Event tickets purchased through our platform may be eligible for refunds based on the event organizer's cancellation policy and our terms.",
        },
        {
          title: "Service Interruptions",
          content:
            "If our platform experiences significant downtime or service interruptions, we may offer credits or refunds at our discretion.",
        },
      ],
    },
    {
      id: "refund-eligibility",
      icon: CheckCircle,
      title: "Refund Eligibility",
      color: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/30",
      iconColor: "text-emerald-500",
      description:
        "Specific conditions under which refunds may be granted for our services.",
      subsections: [
        {
          title: "Event Cancellation",
          content:
            "Full refund if the event is cancelled by the organizer or due to unforeseen circumstances beyond our control.",
        },
        {
          title: "Technical Issues",
          content:
            "Refunds may be considered if technical problems on our platform prevent you from accessing purchased services.",
        },
        {
          title: "Duplicate Purchases",
          content:
            "Refunds for accidental duplicate purchases will be processed after verification of the original transaction.",
        },
      ],
    },
    {
      id: "event-tickets",
      icon: Calendar,
      title: "Event Ticket Refunds",
      color: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      borderColor: "border-purple-500/30",
      iconColor: "text-purple-500",
      description:
        "Specific refund policies for event tickets purchased through our platform.",
      subsections: [
        {
          title: "Event Cancellation by Organizer",
          content:
            "Full refund guaranteed if the event is cancelled. Refund will be processed to your original payment method.",
        },
        {
          title: "Event Rescheduling",
          content:
            "Subject to organizer's policy. You may choose between refund or credit for the rescheduled event date.",
        },
        {
          title: "Weather-Related Cancellations",
          content:
            "Refunds available for outdoor events cancelled due to severe weather conditions that make the event unsafe.",
        },
      ],
    },
    {
      id: "processing-timeline",
      icon: Clock,
      title: "Processing Timeline",
      color: "from-indigo-500/20 via-indigo-500/10 to-indigo-500/5",
      borderColor: "border-indigo-500/30",
      iconColor: "text-indigo-500",
      description:
        "Expected timeframes for refund processing and communication.",
      subsections: [
        {
          title: "Initial Review",
          content:
            "Refund requests are reviewed within 2-3 business days of submission.",
        },
        {
          title: "Processing Time",
          content:
            "Approved refunds are processed within 7-14 business days to your original payment method.",
        },
        {
          title: "Bank Processing",
          content:
            "Additional 3-5 business days may be required for the funds to appear in your account.",
        },
      ],
    },
    {
      id: "request-process",
      icon: Mail,
      title: "How to Request a Refund",
      color: "from-orange-500/20 via-orange-500/10 to-orange-500/5",
      borderColor: "border-orange-500/30",
      iconColor: "text-orange-500",
      description: "Step-by-step process for submitting refund requests.",
      subsections: [
        {
          title: "Gather Information",
          content:
            "Prepare your booking ID, payment receipt, purchase confirmation, and detailed reason for the refund request.",
        },
        {
          title: "Contact Support",
          content:
            "Email us at info@insidekarachi.com with all relevant information and documentation.",
        },
        {
          title: "Response Timeline",
          content:
            "We will acknowledge your request within 24 hours and provide a decision within 2-3 business days.",
        },
      ],
    },
    {
      id: "dispute-resolution",
      icon: AlertTriangle,
      title: "Dispute Resolution",
      color: "from-red-500/20 via-red-500/10 to-red-500/5",
      borderColor: "border-red-500/30",
      iconColor: "text-red-500",
      description: "What to do if you disagree with our refund decision.",
      subsections: [
        {
          title: "Appeal Process",
          content:
            "If your refund request is denied, you may appeal the decision by providing additional documentation or explanation.",
        },
        {
          title: "Escalation",
          content:
            "Escalate to our management team if you remain unsatisfied with the resolution.",
        },
        {
          title: "External Resolution",
          content:
            "For credit card disputes, you may also contact your card issuer for chargeback procedures.",
        },
      ],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-6xl mx-auto space-y-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Table of Contents */}
          <motion.div
            variants={sectionVariants}
            className="bg-gradient-to-r from-primary/5 via-background to-primary/5 rounded-2xl p-8 border border-primary/10 shadow-premium-lg bg-background/95"
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-6 flex items-center">
              <FileText className="h-6 w-6 mr-3 text-primary" />
              Table of Contents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center space-x-3 p-4 rounded-lg hover:bg-primary/10 transition-all duration-300 group hover:shadow-md border border-transparent hover:border-primary/20"
                >
                  <section.icon className={`h-5 w-5 ${section.iconColor}`} />
                  <div>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {index + 1}. {section.title}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {section.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>

          {/* Main Content Sections */}
          {sections.map((section, sectionIndex) => (
            <motion.div
              key={section.id}
              id={section.id}
              variants={sectionVariants}
              className={cn(
                "relative p-8 sm:p-10 md:p-12 rounded-2xl sm:rounded-3xl border bg-background/95 shadow-premium-lg hover:shadow-premium-xl transition-all duration-300 hover:-translate-y-1",
                `bg-gradient-to-br ${section.color}`,
                section.borderColor
              )}
            >
              {/* Section Header */}
              <div className="flex items-center space-x-4 mb-8">
                <div
                  className={cn(
                    "p-4 rounded-xl bg-background/95 border shadow-lg",
                    section.borderColor
                  )}
                >
                  <section.icon className={cn("h-6 w-6", section.iconColor)} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground">
                    {sectionIndex + 1}. {section.title}
                  </h2>
                  <div className="w-12 h-1 bg-primary rounded-full mt-2" />
                </div>
              </div>

              {/* Section Content */}
              <div className="space-y-6">
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                  {section.description}
                </p>

                <div className="grid gap-4">
                  {section.subsections.map((subsection, contentIndex) => (
                    <div
                      key={contentIndex}
                      className="bg-background/95 rounded-lg p-6 border border-border/30 shadow-sm hover:shadow-md transition-all duration-300 hover:bg-background/50"
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                        {subsection.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {subsection.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decorative Element */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-primary/10 rounded-full blur-xl" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
