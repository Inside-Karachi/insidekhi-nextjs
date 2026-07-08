"use client";

import { motion } from "framer-motion";
import {
  Users,
  CreditCard,
  Shield,
  FileText,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function TermsAndConditionsContent() {
  const sections = [
    {
      id: "use-of-services",
      icon: Users,
      title: "Use of Services",
      color: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-500",
      description:
        "You agree to use our platform responsibly and in accordance with applicable laws and regulations.",
      subsections: [
        {
          title: "Acceptable Use",
          content:
            "You agree not to misuse the platform, including but not limited to unlawful activity, fraudulent bookings, spreading false information, or violating the rights of others.",
        },
        {
          title: "Account Responsibility",
          content:
            "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
        },
        {
          title: "Platform Integrity",
          content:
            "You agree not to interfere with the proper functioning of the platform or attempt to gain unauthorized access to our systems.",
        },
      ],
    },
    {
      id: "listings-information",
      icon: FileText,
      title: "Listings & Information",
      color: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/30",
      iconColor: "text-emerald-500",
      description:
        "Inside Karachi provides information about restaurants, hotels, events, and services in Karachi.",
      subsections: [
        {
          title: "Information Accuracy",
          content:
            "While we strive for accuracy, we do not guarantee that all information (e.g., menus, pricing, timings) is up-to-date or complete.",
        },
        {
          title: "Vendor Verification",
          content:
            "Users should verify information directly with vendors before making decisions or purchases.",
        },
        {
          title: "Content Updates",
          content:
            "We regularly update our listings but cannot be held responsible for changes made by vendors without our knowledge.",
        },
      ],
    },
    {
      id: "deals-tickets",
      icon: CreditCard,
      title: "Deals & Tickets",
      color: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
      borderColor: "border-purple-500/30",
      iconColor: "text-purple-500",
      description:
        "Event tickets and deals purchased through our platform are subject to specific terms and conditions.",
      subsections: [
        {
          title: "Availability",
          content:
            "All deals and tickets are subject to availability and may be withdrawn or modified at any time.",
        },
        {
          title: "Vendor Policies",
          content:
            "Each vendor or organizer may have their own terms and conditions that apply to their specific offerings.",
        },
        {
          title: "Intermediary Role",
          content:
            "Inside Karachi acts as an intermediary between you and vendors/organizers and is not responsible for vendor performance or policy changes.",
        },
      ],
    },
    {
      id: "payments",
      icon: CreditCard,
      title: "Payments",
      color: "from-indigo-500/20 via-indigo-500/10 to-indigo-500/5",
      borderColor: "border-indigo-500/30",
      iconColor: "text-indigo-500",
      description:
        "All payments made through our platform are processed securely and in accordance with industry standards.",
      subsections: [
        {
          title: "Payment Processing",
          content:
            "All payments are processed securely through third-party payment gateways that comply with PCI DSS standards.",
        },
        {
          title: "Transaction Fees",
          content:
            "Any applicable service fees or processing charges will be clearly displayed before payment confirmation.",
        },
        {
          title: "Refund Policy",
          content:
            "By making a purchase, you agree to comply with our Refund Policy, which forms part of these Terms & Conditions.",
        },
      ],
    },
    {
      id: "limitation-liability",
      icon: Shield,
      title: "Limitation of Liability",
      color: "from-orange-500/20 via-orange-500/10 to-orange-500/5",
      borderColor: "border-orange-500/30",
      iconColor: "text-orange-500",
      description:
        "Our liability is limited to ensure fair and reasonable terms for both users and the platform.",
      subsections: [
        {
          title: "Service Performance",
          content:
            "Inside Karachi is not responsible for vendor performance, event cancellations, or service quality issues.",
        },
        {
          title: "Liability Cap",
          content:
            "Our liability is limited to the value of the transaction made through our platform, excluding any indirect or consequential losses.",
        },
        {
          title: "Force Majeure",
          content:
            "We are not liable for delays or failures caused by circumstances beyond our reasonable control.",
        },
      ],
    },
    {
      id: "intellectual-property",
      icon: FileText,
      title: "Intellectual Property",
      color: "from-teal-500/20 via-teal-500/10 to-teal-500/5",
      borderColor: "border-teal-500/30",
      iconColor: "text-teal-500",
      description:
        "All content and materials on Inside Karachi are protected by intellectual property laws.",
      subsections: [
        {
          title: "Platform Content",
          content:
            "All content on Inside Karachi (text, images, logos, videos, software) is our property unless otherwise stated.",
        },
        {
          title: "User Content",
          content:
            "By submitting content to our platform, you grant us a license to use, display, and distribute it in connection with our services.",
        },
        {
          title: "Prohibited Use",
          content:
            "You may not reproduce, distribute, or misuse our content without explicit written permission.",
        },
      ],
    },
    {
      id: "modifications",
      icon: AlertTriangle,
      title: "Modifications & Updates",
      color: "from-red-500/20 via-red-500/10 to-red-500/5",
      borderColor: "border-red-500/30",
      iconColor: "text-red-500",
      description:
        "These Terms & Conditions may be updated periodically to reflect changes in our services or legal requirements.",
      subsections: [
        {
          title: "Right to Modify",
          content:
            "We reserve the right to modify these Terms & Conditions at any time without prior notice.",
        },
        {
          title: "Continued Use",
          content:
            "Continued use of our platform after changes constitutes acceptance of the updated Terms & Conditions.",
        },
        {
          title: "Notification",
          content:
            "We will make reasonable efforts to notify users of significant changes through our platform or email communications.",
        },
      ],
    },
    {
      id: "governing-law",
      icon: Scale,
      title: "Governing Law",
      color: "from-gray-500/20 via-gray-500/10 to-gray-500/5",
      borderColor: "border-gray-500/30",
      iconColor: "text-gray-500",
      description:
        "These Terms & Conditions are governed by and construed in accordance with applicable laws.",
      subsections: [
        {
          title: "Jurisdiction",
          content:
            "These Terms & Conditions are governed by the laws of Pakistan, and any disputes shall be subject to the exclusive jurisdiction of Pakistani courts.",
        },
        {
          title: "Severability",
          content:
            "If any provision of these Terms & Conditions is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.",
        },
        {
          title: "Entire Agreement",
          content:
            "These Terms & Conditions, together with our Privacy Policy and Refund Policy, constitute the entire agreement between you and Inside Karachi.",
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
