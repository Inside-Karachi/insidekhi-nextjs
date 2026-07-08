"use client";

import { motion } from "framer-motion";
import { Zap, Clock, Users, FileText, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ServicePolicyContent() {
  const sections = [
    {
      id: "service-fulfillment",
      icon: Zap,
      title: "Service Fulfillment",
      color: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-500",
      description:
        "Inside Karachi is primarily a digital service platform and does not ship physical goods. Our services include city listings, event ticketing, and promotional deals.",
      subsections: [
        {
          title: "Digital Access",
          content:
            "Information, listings, and deals are accessible instantly through our platform once payment is confirmed.",
        },
        {
          title: "Event Tickets",
          content:
            "Delivered digitally via email or downloadable QR code after successful payment confirmation.",
        },
        {
          title: "Vendor Deals",
          content:
            "Service delivery is the responsibility of the vendor. Inside Karachi is not liable for vendor delays or quality issues beyond our control.",
        },
      ],
    },
    {
      id: "service-timelines",
      icon: Clock,
      title: "Service Timelines",
      color: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/30",
      iconColor: "text-emerald-500",
      description:
        "We strive to provide timely service delivery with clear communication about any delays or issues.",
      subsections: [
        {
          title: "Ticket Issuance",
          content:
            "Event tickets are issued immediately upon payment confirmation and sent to your registered email address.",
        },
        {
          title: "Digital Access",
          content:
            "Listings, deals, and digital services become available instantly after successful transaction completion.",
        },
        {
          title: "Delay Communications",
          content:
            "Any delays (e.g., server issues, vendor confirmation) will be communicated to you via email or SMS within 24 hours.",
        },
      ],
    },
    {
      id: "customer-responsibilities",
      icon: Users,
      title: "Customer Responsibilities",
      color: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      borderColor: "border-purple-500/30",
      iconColor: "text-purple-500",
      description:
        "To ensure smooth service delivery, customers are responsible for providing accurate information and following usage guidelines.",
      subsections: [
        {
          title: "Contact Information",
          content:
            "Ensure accurate contact details when making bookings to receive tickets and important updates.",
        },
        {
          title: "Ticket Presentation",
          content:
            "Present digital tickets or codes at the venue/vendor location. Keep backup copies of all digital confirmations.",
        },
        {
          title: "Service Usage",
          content:
            "Use services in accordance with our terms and conditions. Report any issues promptly for resolution.",
        },
      ],
    },
    {
      id: "service-standards",
      icon: CheckCircle,
      title: "Service Standards",
      color: "from-indigo-500/20 via-indigo-500/10 to-indigo-500/5",
      borderColor: "border-indigo-500/30",
      iconColor: "text-indigo-500",
      description:
        "We maintain high standards for service delivery and customer satisfaction across all our digital offerings.",
      subsections: [
        {
          title: "Quality Assurance",
          content:
            "Regular monitoring of service delivery and vendor partnerships to ensure consistent quality.",
        },
        {
          title: "Technical Support",
          content:
            "24/7 technical support for digital service issues and immediate assistance for critical problems.",
        },
        {
          title: "Continuous Improvement",
          content:
            "Ongoing updates and improvements to our platform based on user feedback and technological advancements.",
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
